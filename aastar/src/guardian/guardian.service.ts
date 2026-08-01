import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  zeroAddress,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveChain } from "../common/utils/chain.util";
import { DatabaseService } from "../database/database.service";
import {
  AddGuardianDto,
  RemoveGuardianDto,
  InitiateRecoveryDto,
  SupportRecoveryDto,
  PrepareP256RecoveryDto,
  SubmitP256RecoveryDto,
} from "./dto/guardian.dto";
import { buildProposeRecoveryChallenge, encodeWebAuthnAssertion } from "@aastar/sdk";

// Time lock before recovery can be executed (48 hours in ms)
const RECOVERY_DELAY_MS = 48 * 60 * 60 * 1000;

// Minimum guardians required to support a recovery (M-of-N: 2 out of N)
const RECOVERY_QUORUM = 2;

// ABI fragments for AirAccount social recovery methods.
// Source: AAStarAirAccountBase.sol — proposeRecovery, approveRecovery, executeRecovery, cancelRecovery
// and the activeRecovery() state reader.
const AIRACCOUNT_RECOVERY_ABI = parseAbi([
  // propose a recovery (caller must be a guardian on-chain)
  "function proposeRecovery(address _newOwner) external",
  // approve the current active proposal (caller must be a guardian on-chain)
  "function approveRecovery() external",
  // execute the proposal after timelock and threshold are met (anyone can call)
  "function executeRecovery() external",
  // vote to cancel active recovery (caller must be a guardian on-chain)
  "function cancelRecovery() external",
  // read the active recovery proposal stored on-chain
  "function activeRecovery() external view returns (address newOwner, uint256 proposedAt, uint256 approvalBitmap, uint256 cancellationBitmap)",
]);

// AirAccount v0.20.0 P-256 (WebAuthn passkey) guardian recovery — AirAccountExtension,
// reached via the account `fallback`→`delegatecall` (so calls target the account address).
// Source: airaccount-contract docs/p256-guardian-spec.md §5.2 + getGuardianP256Key / getRecoveryNonce.
const AIRACCOUNT_P256_RECOVERY_ABI = parseAbi([
  // monotonic nonce domain-separating P-256 recovery payloads
  "function getRecoveryNonce() external view returns (uint256)",
  // (x, y) secp256r1 pubkey of guardian slot `index` (zero pair => not a P-256 guardian)
  "function getGuardianP256Key(uint256 index) external view returns (bytes32 x, bytes32 y)",
  // passkey guardian proposes recovery — ANY relayer may submit (sig is the proof)
  "function proposeRecoveryWithSig(address newOwner, uint8 gIdx, bytes sig) external",
]);

// Max guardian slots on-chain (InitConfig guardians/guardianP256X/Y are bytes32[3]/address[3]).
const MAX_GUARDIAN_SLOTS = 3;
const ZERO32 = "0x" + "00".repeat(32);

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService
  ) {}

  // ─── Internal helpers ────────────────────────────────────────────────────

  /**
   * Returns a read-only provider connected to the configured RPC endpoint.
   */
  private getProvider(): any {
    const rpcUrl = this.configService.get<string>("ethRpcUrl");
    if (!rpcUrl) {
      throw new InternalServerErrorException("ETH_RPC_URL is not configured");
    }
    return createPublicClient({ transport: http(rpcUrl) });
  }

  /**
   * The single chain id this service operates on. Every recovery signature is
   * domain-separated with it AND every recovery transaction is broadcast to it,
   * so the two can never diverge (PR #434 review).
   */
  private getChainId(): number {
    const chainId = this.configService.get<number>("chainId");
    if (typeof chainId !== "number" || !Number.isInteger(chainId) || chainId <= 0) {
      throw new InternalServerErrorException(
        `CHAIN_ID is not configured correctly (got ${JSON.stringify(chainId)}). ` +
          "Guardian recovery needs it to domain-separate signatures and to target the right chain."
      );
    }
    return chainId;
  }

  /**
   * The viem chain object for `getChainId()`, used for every recovery write.
   *
   * NOTE: this does NOT by itself validate that ETH_RPC_URL is on that chain.
   * viem only calls `assertCurrentChain` for json-rpc accounts; the relayer here
   * is a local (private-key) account, and `prepareTransactionRequest` short-circuits
   * with `if (chain) return chain.id` — it never issues `eth_chainId`. A mismatch
   * would therefore only surface as an opaque rejection from `eth_sendRawTransaction`,
   * after the user has already completed a passkey ceremony. `assertRpcChain()` is
   * what actually closes that gap; call it before any recovery read/write.
   */
  private getChain(): Chain {
    try {
      return resolveChain(this.getChainId());
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message);
    }
  }

  /**
   * Preflight: the configured chain id must be what ETH_RPC_URL actually serves.
   *
   * Recovery is the one flow where a silent CHAIN_ID/RPC mismatch is expensive —
   * `prepareP256Recovery` reads the nonce and guardian slot from the RPC's chain but
   * domain-separates the challenge with the *configured* chain id, so a mismatch hands
   * the guardian a challenge that can never verify on-chain. Fail here, before the
   * passkey ceremony, rather than at `eth_sendRawTransaction`.
   */
  private async assertRpcChain(): Promise<void> {
    const expected = this.getChainId();
    let actual: number;
    try {
      actual = await this.getProvider().getChainId();
    } catch (err) {
      throw new InternalServerErrorException(
        `Could not read the chain id from ETH_RPC_URL: ${(err as Error).message}`
      );
    }
    if (actual !== expected) {
      throw new InternalServerErrorException(
        `Chain mismatch: CHAIN_ID is ${expected} but ETH_RPC_URL serves chain ${actual}. ` +
          "Guardian recovery signatures are domain-separated with CHAIN_ID, so they would " +
          "never verify on the chain the transaction is broadcast to. Fix the configuration."
      );
    }
  }

  /**
   * Returns a Wallet client backed by ETH_PRIVATE_KEY, used as the relayer
   * for on-chain executeRecovery() calls (no guardian restriction on that
   * function — anyone may call it once conditions are met).
   */
  private getRelayWalletClient(): any {
    // Resolved first so a bad CHAIN_ID reports itself rather than being reported as
    // (or masked by) a key problem — and so the key hint can name the right chain.
    const chain = this.getChain();
    const privateKey = this.configService.get<string>("ethPrivateKey");
    // The .env.example placeholder (scalar 1); rejected so a real funded key must be set.
    // Built at runtime so the 64-hex literal isn't embedded in source (secret-scan hooks).
    const placeholderKey = `0x${"0".repeat(63)}1`;
    if (!privateKey || privateKey === placeholderKey) {
      throw new InternalServerErrorException(
        "ETH_PRIVATE_KEY is not configured or still set to the placeholder value. " +
          `Please set an EOA private key in .env funded on chain ${chain.id} ` +
          "to send on-chain recovery transactions."
      );
    }
    const rpcUrl = this.configService.get<string>("ethRpcUrl");
    const account = privateKeyToAccount(
      (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex
    );
    return createWalletClient({ account, chain, transport: http(rpcUrl) });
  }

  /**
   * Raw read of the on-chain activeRecovery proposal. Returns null only when no
   * proposal is active (newOwner === address(0)) and THROWS if the read itself
   * fails — so callers that must not confuse "nothing proposed" with "could not
   * reach the chain" (see executeRecovery) can tell the two apart.
   */
  private async readActiveRecovery(accountAddress: string): Promise<{
    newOwner: string;
    proposedAt: bigint;
    approvalBitmap: bigint;
    cancellationBitmap: bigint;
  } | null> {
    const provider = this.getProvider();
    const [newOwner, proposedAt, approvalBitmap, cancellationBitmap] = await provider.readContract({
      address: accountAddress as Address,
      abi: AIRACCOUNT_RECOVERY_ABI,
      functionName: "activeRecovery",
    });
    if (newOwner === zeroAddress) {
      return null;
    }
    return { newOwner, proposedAt, cancellationBitmap, approvalBitmap };
  }

  /**
   * Lenient wrapper around readActiveRecovery for the read-only/display paths:
   * a failed read is reported as "no active recovery" rather than propagating.
   * Returns null when no proposal is active (newOwner === address(0)).
   */
  private async fetchOnChainRecovery(accountAddress: string): Promise<{
    newOwner: string;
    proposedAt: bigint;
    approvalBitmap: bigint;
    cancellationBitmap: bigint;
  } | null> {
    try {
      return await this.readActiveRecovery(accountAddress);
    } catch (err) {
      // If the contract does not exist on-chain (e.g. account not yet deployed)
      // treat it as no active recovery rather than crashing.
      this.logger.warn(
        `Could not fetch on-chain activeRecovery for ${accountAddress}: ${(err as Error).message}`
      );
      return null;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async getGuardians(accountAddress: string) {
    const guardians = await this.databaseService.getGuardiansByAccount(accountAddress);
    return guardians.filter(g => g.status !== "revoked");
  }

  async addGuardian(accountAddress: string, dto: AddGuardianDto) {
    if (accountAddress.toLowerCase() === dto.guardianAddress.toLowerCase()) {
      throw new BadRequestException("Account cannot be its own guardian");
    }

    const existing = await this.databaseService.findGuardian(accountAddress, dto.guardianAddress);

    if (existing && existing.status !== "revoked") {
      throw new BadRequestException("Guardian already exists for this account");
    }

    const guardian = {
      id: uuidv4(),
      accountAddress,
      guardianAddress: dto.guardianAddress,
      status: "active",
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };

    await this.databaseService.saveGuardian(guardian);
    return guardian;
  }

  async removeGuardian(accountAddress: string, dto: RemoveGuardianDto) {
    const existing = await this.databaseService.findGuardian(accountAddress, dto.guardianAddress);

    if (!existing || existing.status === "revoked") {
      throw new NotFoundException("Guardian not found for this account");
    }

    await this.databaseService.updateGuardian(existing.id, {
      status: "revoked",
      revokedAt: new Date().toISOString(),
    });

    return { message: "Guardian removed successfully" };
  }

  /**
   * Initiates a recovery request.
   *
   * Off-chain flow (always):
   *   - Validates caller is an active guardian in the database.
   *   - Creates a pending recovery record in the database.
   *
   * On-chain note:
   *   - proposeRecovery() on-chain requires msg.sender to be a registered
   *     guardian of the AirAccount contract, so the backend relayer cannot call
   *     it on behalf of the guardian.  The client (guardian's wallet) must
   *     separately call proposeRecovery() on the AirAccount contract directly.
   *   - This endpoint records intent and tracks quorum off-chain, while
   *     executeRecovery() below enforces the actual on-chain state change.
   *
   * If the account is already deployed on-chain and has an active recovery
   * proposal, we sync that information into the response so the caller knows
   * the current on-chain state.
   */
  async initiateRecovery(callerAddress: string, dto: InitiateRecoveryDto) {
    const { accountAddress, newSignerAddress } = dto;

    // Verify caller is an active guardian
    const guardian = await this.databaseService.findGuardian(accountAddress, callerAddress);
    if (!guardian || guardian.status !== "active") {
      throw new ForbiddenException("Caller is not an active guardian of this account");
    }

    // Check no pending recovery already exists in the database
    const existing = await this.databaseService.findPendingRecovery(accountAddress);
    if (existing) {
      throw new BadRequestException("A recovery request is already pending for this account");
    }

    const executeAfter = Date.now() + RECOVERY_DELAY_MS;

    const request = {
      id: uuidv4(),
      accountAddress,
      newSignerAddress,
      initiatedBy: callerAddress,
      supporters: [callerAddress], // initiator implicitly supports
      status: "pending",
      executeAfter: executeAfter.toString(),
      createdAt: new Date().toISOString(),
      executedAt: null,
    };

    await this.databaseService.saveRecoveryRequest(request);

    // Read on-chain state (best-effort, non-blocking for the db write above)
    const onChainRecovery = await this.fetchOnChainRecovery(accountAddress);

    return {
      ...request,
      executeAfterDate: new Date(executeAfter).toISOString(),
      quorumRequired: RECOVERY_QUORUM,
      supportCount: 1,
      // proposeRecovery() requires msg.sender == guardian, so the backend relayer cannot call it.
      // The guardian's wallet must call it directly on the AirAccount contract.
      requiresOnChainAction: true,
      onChainAction: "proposeRecovery(newSignerAddress)",
      onChainRecoveryActive: onChainRecovery !== null,
      onChainNewOwner: onChainRecovery?.newOwner ?? null,
      note:
        "ACTION REQUIRED: The guardian must call proposeRecovery(newSignerAddress) on the AirAccount " +
        "contract directly (msg.sender must be the guardian — the backend relayer cannot do this). " +
        "The backend will call executeRecovery() on-chain once quorum and timelock are met.",
    };
  }

  /**
   * Records a guardian's support for an existing recovery request.
   *
   * On-chain note: approveRecovery() also requires msg.sender == guardian,
   * so the backend relayer cannot call it.  The guardian's wallet must call
   * approveRecovery() on the contract directly.
   */
  async supportRecovery(callerAddress: string, dto: SupportRecoveryDto) {
    const { accountAddress } = dto;

    // Verify caller is an active guardian
    const guardian = await this.databaseService.findGuardian(accountAddress, callerAddress);
    if (!guardian || guardian.status !== "active") {
      throw new ForbiddenException("Caller is not an active guardian of this account");
    }

    const request = await this.databaseService.findPendingRecovery(accountAddress);
    if (!request) {
      throw new NotFoundException("No pending recovery request for this account");
    }

    const supporters: string[] = Array.isArray(request.supporters)
      ? request.supporters
      : request.supporters
        ? request.supporters.split(",").filter(Boolean)
        : [];

    if (supporters.includes(callerAddress)) {
      throw new BadRequestException("You have already supported this recovery request");
    }

    supporters.push(callerAddress);

    await this.databaseService.updateRecoveryRequest(request.id, { supporters });

    // Read on-chain approval bitmap (best-effort)
    const onChainRecovery = await this.fetchOnChainRecovery(accountAddress);
    const onChainApprovals = onChainRecovery
      ? // Count set bits in approvalBitmap
        [...onChainRecovery.approvalBitmap.toString(2)].filter(b => b === "1").length
      : null;

    return {
      ...request,
      supporters,
      supportCount: supporters.length,
      quorumRequired: RECOVERY_QUORUM,
      quorumReached: supporters.length >= RECOVERY_QUORUM,
      onChainApprovals,
      // approveRecovery() also requires msg.sender == guardian; backend cannot call it.
      requiresOnChainAction: true,
      onChainAction: "approveRecovery()",
      note:
        supporters.length >= RECOVERY_QUORUM
          ? "Quorum reached. ACTION REQUIRED: Guardian must also call approveRecovery() on the contract directly. Once timelock expires, call executeRecovery to finalise on-chain."
          : "Quorum not yet reached. Additional guardian support required. ACTION REQUIRED: Guardian must also call approveRecovery() on the contract directly.",
    };
  }

  /**
   * Executes the recovery.
   *
   * Steps:
   *  1. Validate off-chain quorum and timelock (database checks).
   *  2. Confirm the on-chain active proposal is the one this request tracks —
   *     executeRecovery() is argument-less and acts on whatever the chain has,
   *     which another path may have overwritten.
   *  3. Send an on-chain executeRecovery() transaction using the backend relayer.
   *     This function has no msg.sender restriction in the contract — anyone may
   *     call it once conditions (threshold + timelock) are met on-chain.
   *  4. Wait for the transaction to be mined and confirm success.
   *  5. Update the database only after on-chain success.
   *
   * Any failure causes an exception; the database is NOT updated, so
   * the recovery request stays in "pending" status and can be retried.
   */
  async executeRecovery(accountAddress: string) {
    // ── 1. Off-chain checks ───────────────────────────────────────────────
    const request = await this.databaseService.findPendingRecovery(accountAddress);
    if (!request) {
      throw new NotFoundException("No pending recovery request for this account");
    }

    const supporters: string[] = Array.isArray(request.supporters)
      ? request.supporters
      : request.supporters
        ? request.supporters.split(",").filter(Boolean)
        : [];

    if (supporters.length < RECOVERY_QUORUM) {
      throw new BadRequestException(
        `Recovery requires at least ${RECOVERY_QUORUM} guardian confirmations (current: ${supporters.length})`
      );
    }

    const executeAfter = Number(request.executeAfter);
    if (Date.now() < executeAfter) {
      const remaining = Math.ceil((executeAfter - Date.now()) / 1000 / 60);
      throw new BadRequestException(
        `Recovery time lock has not expired yet. Please wait ${remaining} more minutes.`
      );
    }

    // ── 2. The chain, not the database, decides what executeRecovery() does ──
    // executeRecovery() takes no arguments: it executes whichever proposal is
    // active on-chain. That need not be the one this backend tracked — the passkey
    // path (proposeRecoveryWithSig) and a direct proposeRecovery() call can both
    // overwrite it. Executing blind would hand the account to an owner we never
    // vetted, and then write the *tracked* address into the database, leaving the
    // DB permanently disagreeing with the chain about who owns the account.
    await this.assertRpcChain();

    const onChain = await this.readActiveRecovery(accountAddress).catch(err => {
      // Distinguished from "no proposal": a read failure must not be silently
      // downgraded into a reason to proceed or a misleading 400.
      throw new InternalServerErrorException(
        `Could not read the on-chain recovery proposal for ${accountAddress}: ${(err as Error).message}`
      );
    });
    if (!onChain) {
      throw new BadRequestException(
        "No active recovery proposal on-chain for this account — it may have already been " +
          "executed or cancelled. Refusing to call executeRecovery() blind."
      );
    }
    if (onChain.newOwner.toLowerCase() !== String(request.newSignerAddress).toLowerCase()) {
      throw new BadRequestException(
        `On-chain recovery proposal targets ${onChain.newOwner}, but the pending request targets ` +
          `${request.newSignerAddress}. Refusing to execute a proposal this backend did not track.`
      );
    }

    // ── 3. On-chain executeRecovery() ─────────────────────────────────────
    this.logger.log(
      `Executing on-chain recovery for account=${accountAddress} newOwner=${onChain.newOwner}`
    );

    let txHash: string;
    try {
      const walletClient = this.getRelayWalletClient();
      const provider = this.getProvider();

      const hash = await walletClient.writeContract({
        address: accountAddress as Address,
        abi: AIRACCOUNT_RECOVERY_ABI,
        functionName: "executeRecovery",
        args: [],
        account: walletClient.account!,
        chain: this.getChain(),
      });
      txHash = hash;
      this.logger.log(`On-chain executeRecovery tx sent: ${txHash}`);

      // ── 4. Wait for confirmation ────────────────────────────────────────
      const receipt = await provider.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (!receipt || receipt.status !== "success") {
        throw new Error(
          `Transaction ${txHash} was mined but reverted (status=${receipt?.status ?? "unknown"})`
        );
      }
      this.logger.log(
        `On-chain executeRecovery confirmed in block ${receipt.blockNumber} (tx=${txHash})`
      );
    } catch (err) {
      // On-chain failure: do NOT update the database — the request stays
      // "pending" so the caller can diagnose and retry.
      const message = (err as Error).message ?? String(err);
      this.logger.error(`On-chain executeRecovery failed for ${accountAddress}: ${message}`);
      throw new InternalServerErrorException(
        `On-chain executeRecovery transaction failed: ${message}`
      );
    }

    // ── 5. Update database only after on-chain success ─────────────────
    // The chain has already moved and cannot be rolled back, and PersistenceAdapter
    // has no transaction across its two writes (neither the json nor the postgres
    // adapter offers one). So these two are ORDERED BY BLAST RADIUS rather than
    // wrapped: whichever one we do second is the one that can be left behind.
    //
    // `signerAddress` is the security-relevant record — a stale one has the database
    // naming an owner who no longer controls the account, and it self-heals never,
    // because a retry stops at findPendingRecovery (the request is no longer pending).
    // The request's `status` is bookkeeping: stale is untidy, not dangerous.
    //
    // This narrows the window; it does not close it. Nothing can, while the
    // authoritative record is a chain that cannot join a database transaction —
    // the real answer is reconciling the DB against on-chain state. See issue #446.
    const executedAt = new Date().toISOString();

    // Record what the chain actually did, not what the request asked for. The two
    // are equal by the check above; using the on-chain value keeps its checksummed
    // form and means the DB can never describe an owner the chain didn't set.
    await this.databaseService.updateAccountByAddress(accountAddress, {
      signerAddress: onChain.newOwner,
    });

    try {
      await this.databaseService.updateRecoveryRequest(request.id, {
        status: "executed",
        executedAt,
      });
    } catch (err) {
      // Deliberately not rethrown. The recovery DID happen: it is on-chain and the
      // account row already reflects it. Failing the call here would tell the caller
      // the opposite. Log everything an operator needs to reconcile by hand instead.
      this.logger.error(
        `Recovery ${request.id} executed on-chain (tx=${txHash}, account=${accountAddress} ` +
          `-> ${onChain.newOwner}) but marking the request "executed" failed: ` +
          `${(err as Error).message}. The account row is correct; only the request status ` +
          `is stale — set it to "executed" manually.`
      );
    }

    return {
      message: "Account recovery executed successfully (on-chain + database updated)",
      accountAddress,
      newSignerAddress: onChain.newOwner,
      executedAt,
      txHash,
    };
  }

  async cancelRecovery(callerAddress: string, accountAddress: string) {
    const request = await this.databaseService.findPendingRecovery(accountAddress);
    if (!request) {
      throw new NotFoundException("No pending recovery request for this account");
    }

    // Only a guardian or the original signer of the account can cancel
    const guardian = await this.databaseService.findGuardian(accountAddress, callerAddress);
    const account = await this.databaseService.findAccountByAddress(accountAddress);

    const isGuardian = guardian && guardian.status === "active";
    const isSigner =
      account && account.signerAddress?.toLowerCase() === callerAddress.toLowerCase();

    if (!isGuardian && !isSigner) {
      throw new ForbiddenException(
        "Only an active guardian or the account signer can cancel a recovery"
      );
    }

    await this.databaseService.updateRecoveryRequest(request.id, {
      status: "cancelled",
    });

    return { message: "Recovery request cancelled successfully" };
  }

  async getPendingRecovery(accountAddress: string) {
    const request = await this.databaseService.findPendingRecovery(accountAddress);
    if (!request) return null;

    const supporters: string[] = Array.isArray(request.supporters)
      ? request.supporters
      : request.supporters
        ? request.supporters.split(",").filter(Boolean)
        : [];

    // Enrich with on-chain state (best-effort)
    const onChainRecovery = await this.fetchOnChainRecovery(accountAddress);

    return {
      ...request,
      supporters,
      supportCount: supporters.length,
      quorumRequired: RECOVERY_QUORUM,
      quorumReached: supporters.length >= RECOVERY_QUORUM,
      executeAfterDate: new Date(Number(request.executeAfter)).toISOString(),
      timeLockExpired: Date.now() >= Number(request.executeAfter),
      onChain: onChainRecovery
        ? {
            active: true,
            newOwner: onChainRecovery.newOwner,
            proposedAt: new Date(Number(onChainRecovery.proposedAt) * 1000).toISOString(),
            approvalCount: [...onChainRecovery.approvalBitmap.toString(2)].filter(b => b === "1")
              .length,
          }
        : { active: false },
    };
  }

  // ─── P-256 (passkey) guardian recovery ───────────────────────────────────

  /**
   * Resolve which on-chain guardian slot holds a P-256 (passkey) key.
   * Returns the single non-zero slot's index + (x, y). Errors if there are zero or
   * more than one (the latter needs the guardian's pubkey to disambiguate — not yet
   * supported; our creation flow installs a single passkey guardian).
   */
  private async resolveP256GuardianSlot(
    accountAddress: string
  ): Promise<{ gIdx: number; x: string; y: string }> {
    const provider = this.getProvider();
    const slots: { gIdx: number; x: string; y: string }[] = [];
    for (let i = 0; i < MAX_GUARDIAN_SLOTS; i++) {
      const [x, y] = await provider.readContract({
        address: accountAddress as Address,
        abi: AIRACCOUNT_P256_RECOVERY_ABI,
        functionName: "getGuardianP256Key",
        args: [BigInt(i)],
      });
      if (x !== ZERO32 || y !== ZERO32) {
        slots.push({ gIdx: i, x, y });
      }
    }
    if (slots.length === 0) {
      throw new BadRequestException("This account has no P-256 (passkey) guardian.");
    }
    if (slots.length > 1) {
      throw new BadRequestException(
        "Account has multiple passkey guardians; disambiguating by credential is not yet supported."
      );
    }
    return slots[0];
  }

  /**
   * Step 1 — build the 32-byte challenge the guardian's passkey must sign to propose
   * recovery. Reads the on-chain recovery nonce + the P-256 guardian slot.
   */
  async prepareP256Recovery(dto: PrepareP256RecoveryDto): Promise<{
    challenge: string;
    accountAddress: string;
    newOwner: string;
    gIdx: number;
    nonce: string;
    chainId: number;
  }> {
    // Before anything is read or handed to the passkey: the RPC must be the chain
    // the challenge below is domain-separated for.
    await this.assertRpcChain();

    const provider = this.getProvider();
    const { gIdx } = await this.resolveP256GuardianSlot(dto.accountAddress);
    const nonce: bigint = await provider.readContract({
      address: dto.accountAddress as Address,
      abi: AIRACCOUNT_P256_RECOVERY_ABI,
      functionName: "getRecoveryNonce",
    });
    // Same source as getChain() — the challenge's domain and the chain
    // submitP256Recovery() broadcasts to are the same value by construction.
    const chainId = this.getChainId();

    const challenge = buildProposeRecoveryChallenge({
      chainId,
      account: dto.accountAddress as `0x${string}`,
      nonce,
      newOwner: dto.newOwner as `0x${string}`,
    });

    return {
      challenge,
      accountAddress: dto.accountAddress,
      newOwner: dto.newOwner,
      gIdx,
      nonce: nonce.toString(),
      chainId,
    };
  }

  /**
   * Step 2 — encode the guardian's WebAuthn assertion and RELAY proposeRecoveryWithSig
   * on-chain (the contract accepts any relayer; the backend pays gas). Unlike the ECDSA
   * proposeRecovery() path, the passkey signature — not msg.sender — is the authorization,
   * so the backend relayer CAN submit this.
   */
  async submitP256Recovery(dto: SubmitP256RecoveryDto): Promise<{
    success: boolean;
    transactionHash: string;
    gIdx: number;
    newOwner: string;
  }> {
    // Re-checked here, not just in prepareP256Recovery: the two are separate requests
    // and the relayer must not broadcast to a chain the guardian did not sign for.
    await this.assertRpcChain();

    const { gIdx } = await this.resolveP256GuardianSlot(dto.accountAddress);

    // Encode + validate the assertion (low-S, webauthn.get prefix, challenge slot) —
    // a bad blob fails here with a clear message rather than as an opaque on-chain revert.
    const sig = encodeWebAuthnAssertion({
      authenticatorData: dto.authenticatorData as `0x${string}`,
      clientDataJSON: dto.clientDataJSON as `0x${string}`,
      r: dto.r as `0x${string}`,
      s: dto.s as `0x${string}`,
    });

    const walletClient = this.getRelayWalletClient();
    const provider = this.getProvider();

    try {
      const hash = await walletClient.writeContract({
        address: dto.accountAddress as Address,
        abi: AIRACCOUNT_P256_RECOVERY_ABI,
        functionName: "proposeRecoveryWithSig",
        args: [dto.newOwner as Address, gIdx, sig as Hex],
        account: walletClient.account!,
        chain: this.getChain(),
      });
      const receipt = await provider.waitForTransactionReceipt({ hash });
      if (!receipt || receipt.status !== "success") {
        throw new InternalServerErrorException("proposeRecoveryWithSig transaction reverted");
      }
      this.logger.log(
        `P-256 recovery proposed for ${dto.accountAddress} -> ${dto.newOwner} (gIdx ${gIdx}, tx ${hash})`
      );
      return { success: true, transactionHash: hash, gIdx, newOwner: dto.newOwner };
    } catch (err) {
      const message = (err as Error).message || "Failed to submit passkey recovery";
      this.logger.error(`submitP256Recovery failed for ${dto.accountAddress}: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }
}
