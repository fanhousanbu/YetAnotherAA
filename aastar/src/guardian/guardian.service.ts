import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { DatabaseService } from "../database/database.service";
import {
  AddGuardianDto,
  RemoveGuardianDto,
  InitiateRecoveryDto,
  SupportRecoveryDto,
} from "./dto/guardian.dto";

// Time lock before recovery can be executed (48 hours in ms)
const RECOVERY_DELAY_MS = 48 * 60 * 60 * 1000;

// Minimum guardians required to support a recovery (M-of-N: 2 out of N)
const RECOVERY_QUORUM = 2;

@Injectable()
export class GuardianService {
  constructor(private databaseService: DatabaseService) {}

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

  async initiateRecovery(callerAddress: string, dto: InitiateRecoveryDto) {
    const { accountAddress, newSignerAddress } = dto;

    // Verify caller is an active guardian
    const guardian = await this.databaseService.findGuardian(accountAddress, callerAddress);
    if (!guardian || guardian.status !== "active") {
      throw new ForbiddenException("Caller is not an active guardian of this account");
    }

    // Check no pending recovery already exists
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

    return {
      ...request,
      executeAfterDate: new Date(executeAfter).toISOString(),
      quorumRequired: RECOVERY_QUORUM,
      supportCount: 1,
    };
  }

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

    return {
      ...request,
      supporters,
      supportCount: supporters.length,
      quorumRequired: RECOVERY_QUORUM,
      quorumReached: supporters.length >= RECOVERY_QUORUM,
    };
  }

  async executeRecovery(accountAddress: string) {
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

    // Update recovery request status
    await this.databaseService.updateRecoveryRequest(request.id, {
      status: "executed",
      executedAt: new Date().toISOString(),
    });

    // Update account signerAddress
    await this.databaseService.updateAccountByAddress(accountAddress, {
      signerAddress: request.newSignerAddress,
    });

    return {
      message: "Account recovery executed successfully",
      accountAddress,
      newSignerAddress: request.newSignerAddress,
      executedAt: new Date().toISOString(),
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

    return {
      ...request,
      supporters,
      supportCount: supporters.length,
      quorumRequired: RECOVERY_QUORUM,
      quorumReached: supporters.length >= RECOVERY_QUORUM,
      executeAfterDate: new Date(Number(request.executeAfter)).toISOString(),
      timeLockExpired: Date.now() >= Number(request.executeAfter),
    };
  }
}
