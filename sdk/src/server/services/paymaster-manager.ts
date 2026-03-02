import { ethers } from 'ethers';
import { EthereumProvider } from '../providers/ethereum-provider';
import { IStorageAdapter, PaymasterRecord } from '../interfaces/storage-adapter';
import { ILogger, ConsoleLogger } from '../interfaces/logger';

/**
 * Paymaster manager — extracted from NestJS PaymasterService.
 * Storage via IStorageAdapter instead of filesystem JSON files.
 */
export class PaymasterManager {
  private readonly logger: ILogger;

  constructor(
    private readonly ethereum: EthereumProvider,
    private readonly storage: IStorageAdapter,
    logger?: ILogger,
  ) {
    this.logger = logger ?? new ConsoleLogger('[PaymasterManager]');
  }

  async getAvailablePaymasters(
    userId: string,
  ): Promise<{ name: string; address: string; configured: boolean }[]> {
    const paymasters = await this.storage.getPaymasters(userId);
    return paymasters.map(config => ({
      name: config.name,
      address: config.address,
      configured: !!config.address && config.address !== '0x',
    }));
  }

  async addCustomPaymaster(
    userId: string,
    name: string,
    address: string,
    type: 'pimlico' | 'stackup' | 'alchemy' | 'custom' = 'custom',
    apiKey?: string,
    endpoint?: string,
  ): Promise<void> {
    const paymaster: PaymasterRecord = {
      id: `${userId}-${name}-${Date.now()}`,
      name,
      address,
      type,
      apiKey,
      endpoint,
      createdAt: new Date().toISOString(),
    };
    await this.storage.savePaymaster(userId, paymaster);
  }

  async removeCustomPaymaster(userId: string, name: string): Promise<boolean> {
    return this.storage.removePaymaster(userId, name);
  }

  async getPaymasterData(
    userId: string,
    paymasterName: string,
    userOp: unknown,
    entryPoint: string,
    customAddress?: string,
  ): Promise<string> {
    // Handle custom user-provided paymaster addresses
    if (paymasterName === 'custom-user-provided' && customAddress) {
      const formattedAddress = customAddress.toLowerCase().startsWith('0x')
        ? customAddress
        : `0x${customAddress}`;

      if (!/^0x[a-fA-F0-9]{40}$/.test(formattedAddress)) {
        throw new Error(`Invalid paymaster address format: ${customAddress}`);
      }

      const isV07OrV08 =
        entryPoint.toLowerCase() === '0x0000000071727De22E5E9d8BAf0edAc6f37da032'.toLowerCase() ||
        entryPoint.toLowerCase() === '0x0576a174D229E3cFA37253523E645A78A0C91B57'.toLowerCase();

      if (isV07OrV08) {
        const paymasterVerificationGasLimit = BigInt(0x30000);
        const paymasterPostOpGasLimit = BigInt(0x30000);
        return ethers.concat([
          formattedAddress,
          ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
          ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
          '0x',
        ]);
      }

      return formattedAddress;
    }

    const paymasters = await this.storage.getPaymasters(userId);
    const config = paymasters.find(p => p.name === paymasterName);
    if (!config) {
      throw new Error(`Paymaster ${paymasterName} not found`);
    }

    switch (config.type) {
      case 'pimlico':
        if (!config.apiKey) return '0x';
        return this.getPimlicoPaymasterData(config, userOp, entryPoint);
      case 'stackup':
        if (!config.apiKey) return '0x';
        return this.getStackUpPaymasterData(config, userOp, entryPoint);
      case 'alchemy':
        if (!config.apiKey) return '0x';
        return this.getAlchemyPaymasterData(config, userOp, entryPoint);
      case 'custom':
        if (
          config.address.toLowerCase() ===
            '0x0000000000325602a77416A16136FDafd04b299f'.toLowerCase() &&
          config.apiKey
        ) {
          return this.getPimlicoPaymasterData(
            { ...config, type: 'pimlico', endpoint: 'https://api.pimlico.io/v2/11155111/rpc' },
            userOp,
            entryPoint,
          );
        }
        return config.address;
      default:
        return '0x';
    }
  }

  private async getPimlicoPaymasterData(
    config: PaymasterRecord,
    userOp: unknown,
    entryPoint: string,
  ): Promise<string> {
    const url = `${config.endpoint}?apikey=${config.apiKey}`;
    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'pm_sponsorUserOperation',
        params: [userOp, entryPoint, {}],
        id: 1,
      }),
    });

    const result = (await response.json()) as {
      error?: { message?: string };
      result?: {
        paymasterAndData?: string;
        paymaster?: string;
        paymasterVerificationGasLimit?: string;
        paymasterPostOpGasLimit?: string;
        paymasterData?: string;
      };
    };

    if (result.error) {
      throw new Error(
        `Pimlico sponsorship failed: ${result.error.message || JSON.stringify(result.error)}`,
      );
    }

    if (result.result) {
      if (result.result.paymasterAndData) {
        return result.result.paymasterAndData;
      }
      if (result.result.paymaster) {
        return ethers.concat([
          result.result.paymaster,
          ethers.zeroPadValue(
            ethers.toBeHex(BigInt(result.result.paymasterVerificationGasLimit || '0x30000')),
            16,
          ),
          ethers.zeroPadValue(
            ethers.toBeHex(BigInt(result.result.paymasterPostOpGasLimit || '0x30000')),
            16,
          ),
          result.result.paymasterData || '0x',
        ]);
      }
    }

    throw new Error('Pimlico API did not return valid paymaster data');
  }

  private async getStackUpPaymasterData(
    config: PaymasterRecord,
    userOp: unknown,
    entryPoint: string,
  ): Promise<string> {
    try {
      const response = await globalThis.fetch(`${config.endpoint}/${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'pm_sponsorUserOperation',
          params: { userOperation: userOp, entryPoint, context: { type: 'payg' } },
          id: 1,
        }),
      });
      const result = (await response.json()) as { error?: unknown; result?: string };
      if (result.error) return '0x';
      return result.result || '0x';
    } catch {
      return '0x';
    }
  }

  private async getAlchemyPaymasterData(
    config: PaymasterRecord,
    userOp: unknown,
    entryPoint: string,
  ): Promise<string> {
    try {
      const response = await globalThis.fetch(`${config.endpoint}/${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_requestGasAndPaymasterAndData',
          params: [{ policyId: 'default', entryPoint, userOperation: userOp }],
          id: 1,
        }),
      });
      const result = (await response.json()) as {
        error?: unknown;
        result?: { paymasterAndData?: string };
      };
      if (result.error) return '0x';
      return result.result?.paymasterAndData || '0x';
    } catch {
      return '0x';
    }
  }
}
