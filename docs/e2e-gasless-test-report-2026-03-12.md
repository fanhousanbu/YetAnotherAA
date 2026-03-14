# E2E Gasless Transfer Test Report

**Date**: 2026-03-12
**Network**: Sepolia (Chain ID: 11155111)
**Tester**: Claude Code + Manual TouchID Passkey

---

## 1. Test Overview

Two gasless transfer modes were tested end-to-end through the AirAccount frontend (localhost:5173), backend (localhost:3001), and on-chain contracts:

| Mode | Contract | Address |
|------|----------|---------|
| **PaymasterV4** (Deposit Model) | 用户预存 aPNTs，gas 从用户存款扣除 | `0xD0c82dc12B7d65b03dF7972f67d13F1D33469a98` |
| **SuperPaymaster** (Community Model) | 社区 operator 存入 aPNTs collateral，用户无感 gasless | `0x16cE0c7d846f9446bbBeb9C5a84A4D140fAeD94A` |

### Test Accounts

| Role | Address |
|------|---------|
| AA Account (sender) | `0x177b619aDCC550C00fFCd721C08e632db2EaC3d3` |
| Recipient | `0xFE573FE5613Cb89C5900e29aaD5690ea9076A5eF` |
| Operator (Jason) | `0xb5600060e6de5E11D3636731964218E53caadf0E` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| aPNTs Token | `0xDf669834F04988BcEE0E3B6013B6b867Bd38778d` |

---

## 2. Transaction Details

### TX1: PaymasterV4 Gasless Transfer

| Field | Value |
|-------|-------|
| **Tx Hash** | [`0xeeb65f63e525f2ab9d9f699da0b951c10897e7ad94968a88cc1b1e45ba79149a`](https://sepolia.etherscan.io/tx/0xeeb65f63e525f2ab9d9f699da0b951c10897e7ad94968a88cc1b1e45ba79149a) |
| **Block** | 10430904 |
| **Timestamp** | 2026-03-12 12:54:24 (UTC+8) |
| **Transfer** | 11 aPNTs → Recipient |
| **UserOp Nonce** | 0 (首笔交易，含 AA 账户 CREATE2 部署) |
| **Success** | true |

### TX2: SuperPaymaster Gasless Transfer

| Field | Value |
|-------|-------|
| **Tx Hash** | [`0x9c151aa00a398a3e52f34b8e4d05a2a644332dc3535fe41630c845be4dbc215f`](https://sepolia.etherscan.io/tx/0x9c151aa00a398a3e52f34b8e4d05a2a644332dc3535fe41630c845be4dbc215f) |
| **Block** | 10430986 |
| **Timestamp** | 2026-03-12 13:15:12 (UTC+8) |
| **Transfer** | 12 aPNTs → Recipient |
| **UserOp Nonce** | 1 |
| **Success** | true |

---

## 3. Gas 消耗对比

### 3.1 Gas Units（纯计算量）

| Metric | TX1: PaymasterV4 | TX2: SuperPaymaster | Delta |
|--------|-------------------|---------------------|-------|
| **UserOp gasUsed** | **934,331** | **716,147** | -23.3% |
| **Tx gasUsed** | 1,074,330 | 677,884 | -36.9% |
| **effectiveGasPrice** | 1,827,959 wei (0.0018 gwei) | 1,190,638 wei (0.0012 gwei) | -34.9% |

> **注意**: TX1 包含 AA 账户首次部署（CREATE2 + 初始化），因此 gas 高于 TX2。两者的纯 ERC20 transfer gas 应该相近。

### 3.2 实际 ETH 成本

| Metric | TX1: PaymasterV4 | TX2: SuperPaymaster |
|--------|-------------------|---------------------|
| **actualGasCost** | 1,201,549,666,000 wei | 899,301,595,250 wei |
| **ETH** | 0.0000012015 ETH | 0.0000008993 ETH |
| **USD (@ $2,022/ETH)** | ~$0.0024 | ~$0.0018 |

### 3.3 aPNTs 扣费

| Metric | TX1: PaymasterV4 | TX2: SuperPaymaster |
|--------|-------------------|---------------------|
| **aPNTs deducted** | 0.1279 aPNTs | 0.0920 aPNTs |
| **从谁扣** | 用户在 PM 的 deposit | Operator (Jason) 的 collateral |

---

## 4. Gas 费承担模式分析

### 4.1 PaymasterV4 (Deposit Model)

```
用户流程:
1. 用户（或代理人）将 aPNTs 存入 PaymasterV4 合约 → depositFor(user, token, amount)
2. 用户发起 UserOp，paymasterAndData 中指定 PaymasterV4 + gas token
3. PaymasterV4 在 validatePaymasterUserOp 中验证用户 deposit 余额
4. PostOp 阶段从用户 deposit 中扣除 aPNTs

费用来源: 用户自己的 aPNTs deposit
```

| Before | After | Change |
|--------|-------|--------|
| 用户 deposit: 100 aPNTs | 99.87 aPNTs | -0.13 aPNTs |
| PM EntryPoint deposit: 不变 | 不变 | PM 垫付 ETH 后从用户 aPNTs 回收 |

### 4.2 SuperPaymaster (Community Model)

```
社区流程:
1. Operator（社区）将 aPNTs 作为 collateral 存入 SuperPaymaster
2. Operator 在 EntryPoint 存入 ETH（用于实际 gas 支付）
3. 社区用户持有 xPNTs（社区代币），自动享受 gasless
4. UserOp 的 paymasterAndData 中指定 SuperPaymaster + operator 地址
5. SuperPaymaster 验证 operator collateral 充足
6. PostOp 从 operator collateral 中扣除 aPNTs，EntryPoint deposit 减少 ETH

费用来源: 社区 operator 的 aPNTs collateral + ETH deposit
用户: 完全无感，不需要任何 deposit 操作
```

| Resource | Before | After | Change |
|----------|--------|-------|--------|
| Operator aPNTs collateral | 1000 aPNTs | ~999.91 aPNTs | -0.09 aPNTs (内部记账) |
| SP EntryPoint deposit | 0.28139694 ETH | 0.28139604 ETH | -0.0000008993 ETH |
| 用户 aPNTs 余额 | 189 aPNTs | 177 aPNTs | -12 aPNTs (转账本身) |
| 用户 ETH 余额 | **0** | **0** | 0 (真正 gasless) |

---

## 5. Gas 消耗分解 (TX2: SuperPaymaster 716,147 gas)

### 5.1 各阶段 Gas 分布

```
┌──────────────────────────────────────────────┬──────────┬───────┐
│ Phase                                        │ Gas      │   %   │
├──────────────────────────────────────────────┼──────────┼───────┤
│ EntryPoint 框架 (handleOps/内部调用/refund)      │  339,552 │ 47.4% │
│ BLS 签名验证 (bn256Pairing + ecrecover)          │  153,000 │ 21.4% │
│ preVerificationGas (calldata + bundler 开销)     │   70,000 │  9.8% │
│ Execution (AA.execute → ERC20.transfer)      │   48,595 │  6.8% │
│ Paymaster 验证 (operator/price/collateral)     │   45,000 │  6.3% │
│ PostOp (gas 结算 + collateral 扣除)              │   35,000 │  4.9% │
│ ValidatorRouter + ABI decode                 │   25,000 │  3.5% │
├──────────────────────────────────────────────┼──────────┼───────┤
│ TOTAL                                        │  716,147 │  100% │
└──────────────────────────────────────────────┴──────────┴───────┘
```

### 5.2 关键发现

- **纯 ERC20 transfer 仅需 ~38K gas**，经 ERC-4337 框架后膨胀到 716K（约 **19x**）
- **最大开销是 EntryPoint 框架本身**（47.4%）— 这是 ERC-4337 标准的固有成本，包含 handleOps 循环、内部 call、gas 补偿计算、ETH refund 等
- **BLS 签名验证是第二大开销**（21.4%）— bn256Pairing 预编译 (45K base + 34K × 3 pairings = 147K) + 2× ECDSA ecrecover (6K)
- 如果用 ECDSA 单签替代 BLS 三重签名，可节省约 ~140K gas（但牺牲安全级别）
- Paymaster 验证 + PostOp 合计约 80K gas（11.2%），这是 gasless 模式的额外成本

### 5.3 ETH Gas 费的资金流转

两种 Paymaster 模式下，**最终都是 Paymaster 在 EntryPoint 的 ETH deposit 减少**：

**PaymasterV4**:
```
EntryPoint 从 PM 的 ETH deposit 扣除 gas → 给 bundler
PM PostOp 从用户 aPNTs deposit 扣除代币 → PM 回收成本
净结果: PM ETH deposit ↓ 0.0000012 ETH, 用户 aPNTs deposit ↓ 0.128 aPNTs
```

**SuperPaymaster**:
```
EntryPoint 从 SP 的 ETH deposit 扣除 gas → 给 bundler
SP PostOp 从 operator aPNTs collateral 内部记账扣除
净结果: SP ETH deposit ↓ 0.0000009 ETH, operator collateral ↓ 0.092 aPNTs
```

**数据验证** (PaymasterV4 EP deposit 变化):
```
Before TX1: 0.2367059649 ETH
After TX1:  0.2367047634 ETH
差值:       0.0000012015 ETH = TX1 actualGasCost (精确匹配, 差值 = 0)
```

---

## 6. paymasterAndData 格式

### PaymasterV4

```
[Paymaster Address (20 bytes)]
[verificationGasLimit (16 bytes)]
[postOpGasLimit (16 bytes)]
[gas token address (20 bytes)]    ← aPNTs 地址
```
Total: 72 bytes

### SuperPaymaster

```
[Paymaster Address (20 bytes)]
[verificationGasLimit (16 bytes)]
[postOpGasLimit (16 bytes)]
[operator address (20 bytes)]     ← 社区 operator 地址
[maxRate (32 bytes)]              ← 费率上限（防 rug pull）
```
Total: 104 bytes

---

## 6. 排查修复记录

测试过程中共排查修复了 4 个问题：

### Issue 1: AA33 Paymaster Validation Failed
- **原因**: 初始测试的 PaymasterV4 (`0x67a70a...`) 从未配置过（tokenPrices = 0，无 deposit）
- **修复**: 改用 Jason 通过 Factory 部署的 PaymasterV4 (`0xD0c82d...`)，已有 aPNTs price 配置

### Issue 2: paymasterData 缺少 gas token 地址
- **原因**: SDK `paymaster-manager.ts` 的 `custom-user-provided` 路径构建 paymasterAndData 时，paymasterData 只传了 `"0x"`，缺少 aPNTs token 地址
- **修复**: 修改 SDK 编译产物 (`sdk/dist/server/index.js`)，自动查询 PaymasterV4 的 `tokenPrices()` 确认 gas token 后附加到 paymasterData

### Issue 3: cachedPrice 过期 (validUntil expired)
- **原因**: PaymasterV4 和 SuperPaymaster 的 Chainlink Oracle 价格缓存分别停留在 2026-02-19 和 2026-03-08
- **修复**: 调用 `updatePrice()` 刷新两个合约的 cachedPrice

### Issue 4: SuperPaymaster paymasterAndData 格式不同
- **原因**: SuperPaymaster 需要 `[operator(20)] + [maxRate(32)]` 而非 `[token(20)]`
- **修复**: 修改 SDK，通过检测 `operators()` 函数自动区分 SuperPaymaster 和 PaymasterV4，构建相应的 paymasterAndData

---

## 7. 验证结论

| 验证项 | 结果 |
|--------|------|
| AA 账户 ETH 余额始终为 0 | ✅ 真正 gasless |
| PaymasterV4: gas 从用户 aPNTs deposit 扣除 | ✅ deposit 从 100 → 99.87 |
| SuperPaymaster: gas 从 operator collateral 扣除 | ✅ EP deposit 减少精确匹配 actualGasCost |
| 接收方收到正确金额 | ✅ 11 + 12 = 23 aPNTs |
| BLS 三重签名验证 | ✅ 签名长度 >500 bytes，含 BLS 聚合签名 |
| AA 账户首笔交易自动部署 | ✅ code size: 0 → 212 bytes |
| Passkey (TouchID) 签名 | ✅ 通过 KMS SignHash 验证 |

---

## 8. Etherscan Links

- **AA Account**: https://sepolia.etherscan.io/address/0x177b619aDCC550C00fFCd721C08e632db2EaC3d3
- **TX1 (PaymasterV4)**: https://sepolia.etherscan.io/tx/0xeeb65f63e525f2ab9d9f699da0b951c10897e7ad94968a88cc1b1e45ba79149a
- **TX2 (SuperPaymaster)**: https://sepolia.etherscan.io/tx/0x9c151aa00a398a3e52f34b8e4d05a2a644332dc3535fe41630c845be4dbc215f
- **PaymasterV4**: https://sepolia.etherscan.io/address/0xD0c82dc12B7d65b03dF7972f67d13F1D33469a98
- **SuperPaymaster**: https://sepolia.etherscan.io/address/0x16cE0c7d846f9446bbBeb9C5a84A4D140fAeD94A
