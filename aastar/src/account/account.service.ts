import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EthereumService } from '../ethereum/ethereum.service';
import { AccountInfo, ValidationConfig } from '../common/interfaces/erc4337.interface';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  
  constructor(
    private configService: ConfigService,
    private ethereumService: EthereumService,
  ) {}

  /**
   * 获取账户信息
   */
  async getAccountInfo(
    privateKey: string,
    useAAStarValidator: boolean = false,
    salt: string = '12345'
  ): Promise<AccountInfo> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      const factoryAddress = useAAStarValidator 
        ? this.configService.get('AASTAR_ACCOUNT_FACTORY_ADDRESS')
        : this.configService.get('ENHANCED_FACTORY_ADDRESS');
      
      const validatorAddress = useAAStarValidator 
        ? this.configService.get('VALIDATOR_CONTRACT_ADDRESS')
        : this.configService.get('ECDSA_VALIDATOR_ADDRESS');

      // 获取账户地址
      const accountAddress = await this.getAccountAddress(
        wallet.address,
        useAAStarValidator,
        validatorAddress,
        salt
      );

      // 检查是否已部署
      const isDeployed = await this.isAccountDeployed(accountAddress);

      // 获取余额
      const balance = await this.ethereumService.getBalance(accountAddress);

      // 获取验证配置
      const validationConfig = await this.getValidationConfig(
        accountAddress,
        isDeployed,
        wallet.address,
        useAAStarValidator,
        validatorAddress
      );

      return {
        address: accountAddress,
        isDeployed,
        balance: ethers.formatEther(balance),
        validationConfig,
      };
    } catch (error) {
      this.logger.error(`获取账户信息失败: ${error.message}`);
      throw new Error(`获取账户信息失败: ${error.message}`);
    }
  }

  /**
   * 创建账户(返回预计算的地址，实际部署在第一笔交易时进行)
   */
  async createAccount(
    privateKey: string,
    useAAStarValidator: boolean = false,
    salt: string = '12345'
  ): Promise<AccountInfo> {
    try {
      this.logger.log(`创建账户: useAAStarValidator=${useAAStarValidator}`);
      
      // 验证私钥格式
      const wallet = new ethers.Wallet(privateKey);
      
      return await this.getAccountInfo(privateKey, useAAStarValidator, salt);
    } catch (error) {
      this.logger.error(`创建账户失败: ${error.message}`);
      throw new Error(`创建账户失败: ${error.message}`);
    }
  }

  /**
   * 获取账户地址(预计算)
   */
  private async getAccountAddress(
    ownerAddress: string,
    useAAStarValidator: boolean,
    validatorAddress: string,
    salt: string
  ): Promise<string> {
    const factoryAddress = useAAStarValidator 
      ? this.configService.get('AASTAR_ACCOUNT_FACTORY_ADDRESS')
      : this.configService.get('ENHANCED_FACTORY_ADDRESS');

    if (!factoryAddress) {
      throw new Error(`Factory地址未配置: ${useAAStarValidator ? 'AAStarAccountFactory' : 'EnhancedFactory'}`);
    }

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
   * 检查账户是否已部署
   */
  private async isAccountDeployed(address: string): Promise<boolean> {
    const code = await this.ethereumService.getCode(address);
    return code !== '0x';
  }

  /**
   * 获取验证配置
   */
  private async getValidationConfig(
    accountAddress: string,
    isDeployed: boolean,
    ownerAddress: string,
    useAAStarValidator: boolean,
    validatorAddress: string
  ): Promise<ValidationConfig> {
    if (!isDeployed) {
      // 账户未部署，返回预期配置
      return {
        validator: useAAStarValidator ? validatorAddress : ethers.ZeroAddress,
        isCustom: useAAStarValidator,
        accountOwner: ownerAddress,
      };
    }

    try {
      const accountAbi = [
        'function getValidationConfig() view returns (address validator, bool isCustom, address accountOwner)'
      ];

      const account = new ethers.Contract(
        accountAddress,
        accountAbi,
        this.ethereumService.getProvider()
      );

      const config = await account.getValidationConfig();
      return {
        validator: config.validator,
        isCustom: config.isCustom,
        accountOwner: config.accountOwner,
      };
    } catch (error) {
      this.logger.warn(`无法获取验证配置，返回默认值: ${error.message}`);
      return {
        validator: useAAStarValidator ? validatorAddress : ethers.ZeroAddress,
        isCustom: useAAStarValidator,
        accountOwner: ownerAddress,
      };
    }
  }

  /**
   * 更新验证器配置(仅对已部署的账户)
   */
  async updateValidator(
    privateKey: string,
    validatorAddress: string,
    useCustomValidator: boolean
  ): Promise<void> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.ethereumService.getProvider());
      
      // 获取账户信息
      const accountInfo = await this.getAccountInfo(privateKey);
      
      if (!accountInfo.isDeployed) {
        throw new Error('账户尚未部署，无法更新验证器配置');
      }

      const accountAbi = [
        'function setSignatureValidator(address _signatureValidator, bool _useCustomValidator)'
      ];

      const account = new ethers.Contract(
        accountInfo.address,
        accountAbi,
        wallet
      );

      const tx = await account.setSignatureValidator(validatorAddress, useCustomValidator);
      await tx.wait();

      this.logger.log(`验证器配置已更新: ${validatorAddress}, useCustom: ${useCustomValidator}`);
    } catch (error) {
      this.logger.error(`更新验证器失败: ${error.message}`);
      throw new Error(`更新验证器失败: ${error.message}`);
    }
  }
}