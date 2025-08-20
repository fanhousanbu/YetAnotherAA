import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { CreateAccountDto, GetAccountDto, AccountInfoDto, UpdateValidatorDto } from './dto/account.dto';
import { BaseResponseDto } from '../common/dto/base.dto';

@ApiTags('accounts')
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @ApiOperation({ summary: '创建新账户' })
  @ApiResponse({ 
    status: 201, 
    description: '账户创建成功',
    type: BaseResponseDto<AccountInfoDto>
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  async createAccount(@Body() createAccountDto: CreateAccountDto) {
    try {
      const accountInfo = await this.accountService.createAccount(
        createAccountDto.privateKey,
        createAccountDto.useAAStarValidator || false,
        createAccountDto.salt || '12345'
      );

      return BaseResponseDto.success(accountInfo, '账户创建成功');
    } catch (error) {
      throw new HttpException(
        BaseResponseDto.error(error.message, 'ACCOUNT_CREATE_FAILED'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  @ApiOperation({ summary: '获取账户信息' })
  @ApiResponse({ 
    status: 200, 
    description: '获取账户信息成功',
    type: BaseResponseDto<AccountInfoDto>
  })
  @ApiQuery({ name: 'privateKey', description: '账户私钥' })
  @ApiQuery({ name: 'useAAStarValidator', description: '是否使用AAStarValidator', required: false })
  @ApiQuery({ name: 'salt', description: '盐值', required: false })
  async getAccount(@Query() getAccountDto: GetAccountDto) {
    try {
      const accountInfo = await this.accountService.getAccountInfo(
        getAccountDto.privateKey,
        getAccountDto.useAAStarValidator || false,
        getAccountDto.salt || '12345'
      );

      return BaseResponseDto.success(accountInfo, '获取账户信息成功');
    } catch (error) {
      throw new HttpException(
        BaseResponseDto.error(error.message, 'ACCOUNT_GET_FAILED'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('update-validator')
  @ApiOperation({ summary: '更新账户验证器配置' })
  @ApiResponse({ 
    status: 200, 
    description: '验证器配置更新成功'
  })
  @ApiResponse({ status: 400, description: '更新失败' })
  async updateValidator(@Body() updateValidatorDto: UpdateValidatorDto) {
    try {
      await this.accountService.updateValidator(
        updateValidatorDto.privateKey,
        updateValidatorDto.validatorAddress,
        updateValidatorDto.useCustomValidator
      );

      return BaseResponseDto.success(null, '验证器配置更新成功');
    } catch (error) {
      throw new HttpException(
        BaseResponseDto.error(error.message, 'VALIDATOR_UPDATE_FAILED'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}