import { defineChain, type Chain } from "viem";
import {
  mainnet,
  sepolia,
  optimism,
  optimismSepolia,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia,
} from "viem/chains";

/**
 * The chains this backend is realistically configured against. Keeping an explicit
 * list (rather than scanning all of `viem/chains`) makes resolution deterministic —
 * several viem chain objects share an id, so a scan can silently pick the wrong one.
 */
const KNOWN_CHAINS: readonly Chain[] = [
  mainnet,
  sepolia,
  optimism,
  optimismSepolia,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia,
];

/**
 * Resolves a configured `chainId` to the viem `Chain` object used when broadcasting.
 *
 * Why this exists: viem requires an explicit `chain` on every write, and hardcoding
 * one (e.g. `sepolia`) lets the broadcast target drift away from the chainId that
 * domain-separates a signature — the signature then verifies against a chain the
 * transaction never touches. Both sides must read the same config value, so both
 * go through here. See PR #434 review.
 *
 * This resolves config → Chain and nothing more. It deliberately does NOT verify that
 * the RPC endpoint is on that chain: viem runs `assertCurrentChain` only for json-rpc
 * accounts, and for a local (private-key) account `prepareTransactionRequest` returns
 * `chain.id` without ever issuing `eth_chainId`. Callers that sign or broadcast must
 * preflight the RPC themselves (see GuardianService.assertRpcChain).
 *
 * Unknown ids get a minimal descriptor, which is sound only for chains with standard
 * EVM transaction serialization and fee behavior (it carries no custom
 * formatters/serializers) — enough for local devnets like anvil's 31337. A chain that
 * needs viem's chain-specific handling must be added to KNOWN_CHAINS above.
 */
export function resolveChain(chainId: number): Chain {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(
      `Invalid chainId "${chainId}" — expected a positive integer. Set CHAIN_ID in the environment.`
    );
  }

  const known = KNOWN_CHAINS.find(chain => chain.id === chainId);
  if (known) return known;

  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    // Empty on purpose: every client in this codebase passes its own `http(rpcUrl)`
    // transport, so this is never dereferenced. Anyone who later builds a client from
    // `resolveChain(id)` alone — letting viem fall back to `chain.rpcUrls` — must supply
    // a real URL here first, or they will get an unhelpful "no URL" failure.
    rpcUrls: { default: { http: [] } },
  });
}

/**
 * Validates a `chainId` read from config. `configuration.ts` always supplies a value,
 * so a non-number here means the config wiring itself is broken — worth saying so
 * rather than silently falling back to a hardcoded default, which is exactly how the
 * broadcast chain drifted away from the signature domain in the first place (#434).
 */
export function assertValidChainId(chainId: unknown): number {
  if (typeof chainId !== "number" || !Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(
      `CHAIN_ID is not configured correctly (got ${JSON.stringify(chainId)}). ` +
        "It domain-separates signatures and selects the chain transactions are sent to."
    );
  }
  return chainId;
}

/**
 * Preflight: the configured chain id must be what the RPC endpoint actually serves.
 *
 * `resolveChain` alone cannot give this guarantee — see its note on viem skipping
 * `assertCurrentChain` for local accounts. Anything that signs for, or broadcasts to,
 * a specific chain should call this first so a CHAIN_ID/ETH_RPC_URL mismatch fails
 * immediately instead of after a user-visible signing ceremony.
 *
 * `why` is appended to the error to say what the mismatch would have broken.
 */
export async function assertRpcChain(
  client: { getChainId: () => Promise<number> },
  expected: number,
  why: string
): Promise<void> {
  let actual: number;
  try {
    actual = await client.getChainId();
  } catch (err) {
    throw new Error(`Could not read the chain id from ETH_RPC_URL: ${(err as Error).message}`);
  }
  if (actual !== expected) {
    throw new Error(
      `Chain mismatch: CHAIN_ID is ${expected} but ETH_RPC_URL serves chain ${actual}. ${why}`
    );
  }
}
