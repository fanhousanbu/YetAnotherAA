import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EthereumService } from '../ethereum/ethereum.service';
import { AccountService } from '../account/account.service';
import { UserOperation } from '../common/interfaces/erc4337.interface';
import { BlsService } from '../bls/bls.service';

export interface TransferResult {
  userOpHash: string;
  accountAddress: string;
  toAddress: string;
  amount: string;
  transactionHash?: string;
  success: boolean;
  gasUsed?: string;
  error?: string;
  validatorType: 'ECDSA' | 'AAStarValidator';
}

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private configService: ConfigService,
    private ethereumService: EthereumService,
    private accountService: AccountService,
    private blsService: BlsService,
  ) {}

  /**
   * 执行转账
   */
  async transfer(
    fromPrivateKey: string,
    toAddress: string,
    amount: string,
    useAAStarValidator: boolean = false,
    nodeIds?: string[],
    salt: string = '12345'
  ): Promise<TransferResult> {
    try {
      this.logger.log(`开始转账: ${amount} ETH -> ${toAddress}`);
      this.logger.log(`使用AAStarValidator: ${useAAStarValidator}`);

      // 验证参数
      if (useAAStarValidator && (!nodeIds || nodeIds.length === 0)) {
        throw new Error('使用AAStarValidator时必须提供nodeIds');
      }

      // 获取或创建账户信息
      const accountInfo = await this.accountService.getAccountInfo(
        fromPrivateKey,
        useAAStarValidator,
        salt
      );

      // 检查余额
      const transferAmountWei = ethers.parseEther(amount);
      const balanceWei = ethers.parseEther(accountInfo.balance);
      
      if (balanceWei < transferAmountWei) {
        throw new Error(`余额不足: 当前${accountInfo.balance} ETH, 需要${amount} ETH`);
      }

      // 创建UserOperation
      const userOp = await this.createUserOperation(
        fromPrivateKey,
        accountInfo.address,
        toAddress,
        transferAmountWei,
        useAAStarValidator,
        nodeIds,
        salt
      );

      // 发送到Bundler
      const userOpHash = await this.ethereumService.sendUserOperationToBundler(userOp);
      this.logger.log(`UserOperation已提交: ${userOpHash}`);

      // 等待执行结果
      const receipt = await this.ethereumService.waitForUserOperationReceipt(userOpHash);
      
      const result: TransferResult = {
        userOpHash,
        accountAddress: accountInfo.address,
        toAddress,
        amount,
        success: receipt.success,
        validatorType: useAAStarValidator ? 'AAStarValidator' : 'ECDSA',
      };

      if (receipt.success) {
        result.transactionHash = receipt.receipt.transactionHash;
        result.gasUsed = receipt.receipt.gasUsed;
        this.logger.log(`转账成功: ${receipt.receipt.transactionHash}`);
      } else {
        result.error = '转账失败';
        this.logger.error('转账失败');
      }

      return result;
    } catch (error) {
      this.logger.error(`转账失败: ${error.message}`);
      throw new Error(`转账失败: ${error.message}`);
    }
  }

  /**
   * 创建UserOperation
   */
  private async createUserOperation(
    privateKey: string,
    accountAddress: string,
    target: string,
    value: bigint,
    useAAStarValidator: boolean,
    nodeIds?: string[],
    salt: string = '12345'
  ): Promise<UserOperation> {
    const wallet = this.ethereumService.createWallet(privateKey);
    const entryPointAddress = this.configService.get<string>('ENTRY_POINT_ADDRESS');

    // 获取初始化代码
    const initCode = await this.getInitCode(
      wallet.address,
      useAAStarValidator,
      salt
    );

    // 获取nonce
    const nonce = await this.ethereumService.getNonce(accountAddress, entryPointAddress);

    // 编码执行调用
    const callData = this.encodeExecuteCall(target, value, '0x');

    // 获取费用数据
    const feeData = await this.ethereumService.getFeeData();

    const userOp: UserOperation = {
      sender: accountAddress,
      nonce: '0x' + nonce.toString(16),
      initCode,
      callData,
      callGasLimit: '0x55555',
      verificationGasLimit: useAAStarValidator ? '0x100000' : '0x55555', // AAStarValidator需要更多gas
      preVerificationGas: '0x55555',
      maxFeePerGas: '0x' + (feeData.maxFeePerGas?.toString(16) || '0'),
      maxPriorityFeePerGas: '0x' + (feeData.maxPriorityFeePerGas?.toString(16) || '0'),
      paymasterAndData: '0x',
      signature: '0x',
    };

    // 计算UserOperation哈希并签名
    const userOpHash = await this.getUserOpHash(userOp);
    userOp.signature = await this.signUserOp(
      userOpHash,
      privateKey,
      useAAStarValidator,
      nodeIds
    );

    return userOp;
  }

  /**
   * 获取初始化代码
   */
  private async getInitCode(
    ownerAddress: string,
    useAAStarValidator: boolean,
    salt: string
  ): Promise<string> {
    const factoryAddress = useAAStarValidator
      ? this.configService.get('SIMPLIFIED_FACTORY_ADDRESS')  // 使用简化版工厂
      : this.configService.get('ENHANCED_FACTORY_ADDRESS');

    if (!factoryAddress) {
      throw new Error(`Factory地址未配置: ${useAAStarValidator ? 'AAStarAccountFactory' : 'EnhancedFactory'}`);
    }

    // 检查账户是否已部署
    const accountAddress = await this.getAccountAddress(ownerAddress, useAAStarValidator, salt);
    const code = await this.ethereumService.getCode(accountAddress);

    if (code !== '0x') {
      return '0x'; // 账户已部署
    }

    const factoryAbi = [
      'function createAccount(address owner, uint256 salt) returns (address)',
      'function createAccountWithValidator(address owner, address validator, bool useCustomValidator, uint256 salt) returns (address)',
      'function createAAStarAccount(address owner, address aaStarValidator, uint256 salt) returns (address)'
    ];

    const iface = new ethers.Interface(factoryAbi);

    if (useAAStarValidator) {
      const validatorAddress = this.configService.get('VALIDATOR_CONTRACT_ADDRESS');
      const encodedCall = iface.encodeFunctionData('createAAStarAccount', [
        ownerAddress,
        validatorAddress,
        salt
      ]);
      return ethers.concat([factoryAddress, encodedCall]);
    } else {
      const encodedCall = iface.encodeFunctionData('createAccount', [
        ownerAddress,
        salt
      ]);
      return ethers.concat([factoryAddress, encodedCall]);
    }
  }

  /**
   * 获取账户地址
   */
  private async getAccountAddress(
    ownerAddress: string,
    useAAStarValidator: boolean,
    salt: string
  ): Promise<string> {
    const factoryAddress = useAAStarValidator
      ? this.configService.get('SIMPLIFIED_FACTORY_ADDRESS')  // 使用简化版工厂
      : this.configService.get('ENHANCED_FACTORY_ADDRESS');

    const factoryAbi = [
      'function getAddress(address owner, uint256 salt) view returns (address)',
      'function getAddress(address owner, address validator, bool useCustomValidator, uint256 salt) view returns (address)'
    ];

    const factory = new ethers.Contract(
      factoryAddress,
      factoryAbi,
      this.ethereumService.getProvider()
    );

    if (useAAStarValidator) {
      const validatorAddress = this.configService.get('VALIDATOR_CONTRACT_ADDRESS');
      return await factory['getAddress(address,address,bool,uint256)'](
        ownerAddress,
        validatorAddress,
        true,
        salt
      );
    } else {
      return await factory['getAddress(address,uint256)'](ownerAddress, salt);
    }
  }

  /**
   * 编码执行调用
   */
  private encodeExecuteCall(target: string, value: bigint, data: string): string {
    const executeAbi = ['function execute(address,uint256,bytes)'];
    const iface = new ethers.Interface(executeAbi);
    return iface.encodeFunctionData('execute', [target, value, data]);
  }

  /**
   * 获取UserOperation哈希
   */
  private async getUserOpHash(userOp: UserOperation): Promise<string> {
    const chainId = await this.ethereumService.getChainId();
    const entryPointAddress = this.configService.get<string>('ENTRY_POINT_ADDRESS');

    const packedUserOp = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        'address', 'uint256', 'bytes32', 'bytes32', 'uint256',
        'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'
      ],
      [
        userOp.sender,
        userOp.nonce,
        ethers.keccak256(userOp.initCode),
        ethers.keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        ethers.keccak256(userOp.paymasterAndData),
      ]
    );

    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [ethers.keccak256(packedUserOp), entryPointAddress, chainId]
      )
    );
  }

  /**
   * 签名UserOperation
   */
  private async signUserOp(
    userOpHash: string,
    privateKey: string,
    useAAStarValidator: boolean,
    nodeIds?: string[]
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);

    if (useAAStarValidator) {
      this.logger.log('开始AAStarValidator签名流程');
      
      try {
        // 1. 检查BLS服务健康状态
        const isHealthy = await this.blsService.healthCheck();
        if (!isHealthy) {
          throw new Error('BLS签名服务不可用，请检查signer服务是否启动');
        }

        // 2. 简化版签名逻辑：BLS和ECDSA都对userOpHash签名
        this.logger.log('使用简化版签名策略：BLS和ECDSA都对userOpHash签名');
        
        // BLS签名：直接对userOpHash签名
        const blsResult = await this.blsService.signMessage(
          userOpHash,  // BLS对userOpHash签名
          nodeIds
        );
        
        this.logger.log(`BLS签名完成，参与节点: ${blsResult.participatingNodes.length} 个`);

        // 3. 构造AAStarValidator签名格式: [nodeIdsLength][nodeIds...][blsSignature][aaSignature]
        const participatingNodeIds = blsResult.participatingNodes;
        
        // 确保nodeIdsLength编码为32字节
        const nodeIdsLength = ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint256'], 
          [participatingNodeIds.length]
        );
        
        // 确保每个nodeId都是32字节的bytes32格式
        const nodeIdsData = participatingNodeIds.length > 0 ? 
          ethers.concat(
            participatingNodeIds.map(id => {
              // 确保nodeId是完整的32字节
              if (id.startsWith('0x')) {
                return id.length === 66 ? id : '0x' + id.slice(2).padStart(64, '0');
              } else {
                return '0x' + id.padStart(64, '0');
              }
            })
          ) : 
          '0x';
        
        // 使用聚合签名结果 - 确保是256字节
        const blsSignature = blsResult.aggregatedSignature;
        this.logger.log(`BLS签名长度: ${ethers.getBytes(blsSignature).length} 字节`);
        
        // AA签名 - 简化版：也对userOpHash进行ECDSA签名
        const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));
        
        // 验证签名长度
        const aaSignatureBytes = ethers.getBytes(aaSignature);
        this.logger.log(`ECDSA签名长度: ${aaSignatureBytes.length} 字节`);
        
        if (aaSignatureBytes.length !== 65) {
          throw new Error(`ECDSA签名长度错误，期望65字节，实际${aaSignatureBytes.length}字节`);
        }
        
        // 构造最终签名
        const finalSignature = ethers.concat([nodeIdsLength, nodeIdsData, blsSignature, aaSignature]);
        
        this.logger.log('AAStarValidator签名格式构造完成:');
        this.logger.log(`  - nodeIdsLength: ${ethers.getBytes(nodeIdsLength).length} 字节`);
        this.logger.log(`  - nodeIdsData: ${ethers.getBytes(nodeIdsData).length} 字节`);
        this.logger.log(`  - blsSignature: ${ethers.getBytes(blsSignature).length} 字节`);
        this.logger.log(`  - aaSignature: ${ethers.getBytes(aaSignature).length} 字节`);
        this.logger.log(`  - 总长度: ${ethers.getBytes(finalSignature).length} 字节`);
        
        return finalSignature;
        
      } catch (error) {
        this.logger.error(`AAStarValidator签名失败: ${error.message}`);
        // 如果BLS签名失败，可以选择降级到ECDSA签名或抛出错误
        throw new Error(`AAStarValidator签名失败: ${error.message}`);
      }
    } else {
      // 标准ECDSA签名
      return await wallet.signMessage(ethers.getBytes(userOpHash));
    }
  }

  /**
   * 生成G2 messagePoint (与合约_hashToCurveG2保持一致)
   * 这是简化实现，与AAStarAccountV6.sol中的实现相同
   */
  private hashToCurveG2(hash: string): string {
    // 创建256字节的messagePoint
    const messagePoint = new Uint8Array(256);
    
    // 基于hash生成确定性seed
    const seed = ethers.keccak256(ethers.concat([hash, ethers.toUtf8Bytes("BLS_G2_POINT")]));
    
    // 使用确定性数据填充G2点结构
    for (let i = 0; i < 8; i++) {
      const chunk = ethers.keccak256(ethers.concat([seed, ethers.toBeHex(i, 32)]));
      const chunkBytes = ethers.getBytes(chunk);
      for (let j = 0; j < 32; j++) {
        messagePoint[i * 32 + j] = chunkBytes[j];
      }
    }
    
    return ethers.hexlify(messagePoint);
  }
}