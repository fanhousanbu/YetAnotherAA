# 📋 Paymaster Function Map

## 🎯 Paymaster 系统完整函数地图

### 1. SponsorPaymaster Contract

#### Constructor
```solidity
constructor(
    address _xPNTsToken,     // aPNTs token address
    uint256 _sponsorshipCap  // Maximum total sponsorship amount
)
```
- **作用**: 初始化 Paymaster
- **参数**:
  - `_xPNTsToken`: aPNTs 代币合约地址
  - `_sponsorshipCap`: 赞助上限（例如 10 ETH）

#### Core Functions

##### ① validateAndSponsor()
```solidity
function validateAndSponsor(
    address user,
    bytes32 userOpHash,
    uint256 maxCost,
    bytes calldata signature
) external returns (uint256 validationData)
```
**功能**: 验证并赞助 UserOperation

**流程**:
1. 检查用户签名 ✅
2. 检查是否已赞助过 ✅
3. 检查每日限额 ✅
4. 检查总赞助上限 ✅
5. 尝试扣除用户 aPNTs ✅
6. 更新赞助记录 ✅

**返回值**:
- `0`: 验证通过
- `1`: 签名无效
- `2`: 已赞助过
- `3`: 超过日限额
- `4`: 超过总上限

##### ② postOp()
```solidity
function postOp(
    address user,
    bytes32 userOpHash,
    uint256 actualGasCost
) external
```
**功能**: 交易执行后的清算

**流程**:
1. 验证调用者权限
2. 记录实际 gas 消耗
3. 可选：额外扣款/退款逻辑

##### ③ deposit()
```solidity
function deposit() external payable
```
**功能**: 向 Paymaster 充值 ETH

**使用**:
```bash
cast send <PAYMASTER_ADDRESS> --value 0.1ether
```

##### ④ withdraw()
```solidity
function withdraw(uint256 amount) external onlyOwner
```
**功能**: 提取 Paymaster 中的 ETH（仅 owner）

#### View Functions

##### ① isUserSponsored()
```solidity
function isUserSponsored(address user) external view returns (bool)
```
**功能**: 检查用户是否已被赞助

##### ② getBalance()
```solidity
function getBalance() external view returns (uint256)
```
**功能**: 获取 Paymaster ETH 余额

##### ③ isDailyLimitExceeded()
```solidity
function isDailyLimitExceeded(uint256 amount) internal view returns (bool)
```
**功能**: 检查是否超过每日限额

---

### 2. MinimalDelegationContract + Paymaster Integration

#### validateUserOp() - Paymaster 验证入口
```solidity
function validateUserOp(
    bytes32 userOpHash,
    UserOperation calldata userOp,
    uint256 missingAccountFunds
) external payable onlyPaymaster returns (uint256 validationData)
```

**完整验证流程**:

```
Step 1: 检查 SBT 所有权
├─ if (SBT_CONTRACT != address(0))
│   └─ 检查 balanceOf(OWNER) > 0
│      └─ 失败 → return 1 (No SBT)
│
Step 2: 检查 aPNTs 最小余额
├─ balance = IERC20(XPNTS_CONTRACT).balanceOf(OWNER)
├─ if (balance < MIN_APNTS_BALANCE) // 10 aPNTs
│   └─ return 2 (Balance < 10 aPNTs)
│
Step 3: 计算所需 aPNTs
├─ apntsNeeded = (missingAccountFunds * ETH_PRICE_USD * 1000) / APNTS_PRICE_USD
├─ Formula: (ETH wei * 3500 * 1000) / 21
│   └─ 示例: 0.001 ETH = 166.67 aPNTs
│
Step 4: 检查余额充足性
├─ if (balance < apntsNeeded)
│   └─ return 3 (Insufficient aPNTs)
│
Step 5: Approve Paymaster
└─ IERC20(XPNTS_CONTRACT).approve(paymaster, apntsNeeded)
   └─ return 0 (Valid) ✅
```

#### postOp() - Gas 费用扣除
```solidity
function postOp(uint256 actualGasCost) external onlyPaymaster
```

**扣款流程**:
```
Step 1: 计算 aPNTs 数量
├─ apntsAmount = (actualGasCost * ETH_PRICE_USD * 1000) / APNTS_PRICE_USD
│   └─ 示例: 0.002 ETH × 3500 / 0.021 = 333.33 aPNTs
│
Step 2: 转账 aPNTs
└─ IERC20(XPNTS_CONTRACT).transferFrom(OWNER, paymaster, apntsAmount)
   └─ 成功 ✅ / 失败 → revert InsufficientBalance
```

---

## 🔄 Complete ERC-4337 + Paymaster Flow

### 完整交易流程图

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: 用户构造 UserOperation                              │
├─────────────────────────────────────────────────────────────┤
│  sender: Delegation Contract Address                        │
│  callData: execute(target, value, data)                     │
│  paymasterAndData: [PaymasterAddress][验证数据]              │
│  signature: 用户签名                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: 提交给 Bundler                                      │
├─────────────────────────────────────────────────────────────┤
│  - Bundler 验证 UserOp 格式                                  │
│  - 检查 nonce, gas limits                                    │
│  - 打包多个 UserOps                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: EntryPoint.handleOps()                             │
├─────────────────────────────────────────────────────────────┤
│  Loop for each UserOp:                                       │
│    3.1 验证阶段                                               │
│    3.2 执行阶段                                               │
│    3.3 后处理阶段                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3.1: Validation Phase                                 │
├─────────────────────────────────────────────────────────────┤
│  A. 调用 Paymaster.validatePaymasterUserOp()                 │
│     ├─ Paymaster 检查赞助条件                                │
│     ├─ 计算所需 gas 费用                                     │
│     └─ return validationData (0 = valid)                    │
│                                                              │
│  B. 调用 Delegation.validateUserOp()                         │
│     ├─ 检查 SBT 所有权 ✅                                    │
│     ├─ 检查 aPNTs >= 10 ✅                                   │
│     ├─ 计算所需 aPNTs ✅                                     │
│     ├─ 检查余额充足 ✅                                       │
│     └─ Approve Paymaster ✅                                 │
│                                                              │
│  Result: validationData == 0 → 继续执行                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3.2: Execution Phase                                  │
├─────────────────────────────────────────────────────────────┤
│  EntryPoint 调用: Delegation.execute(target, value, data)    │
│     ├─ 验证 msg.sender == OWNER ✅                           │
│     ├─ 检查 target != address(0) ✅                          │
│     ├─ 检查 SBT ownership (如果需要) ✅                      │
│     └─ 执行 target.call{value}(data) ✅                      │
│                                                              │
│  示例: MockUSDC.transfer(recipient, amount)                  │
│     └─ 转账成功 ✅                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3.3: Post-Operation Phase                             │
├─────────────────────────────────────────────────────────────┤
│  A. EntryPoint 计算实际 gas 消耗                             │
│     └─ actualGasCost = gasUsed × gasPrice                   │
│                                                              │
│  B. 调用 Paymaster.postOp(actualGasCost)                     │
│     └─ Paymaster 记录并清算                                  │
│                                                              │
│  C. 调用 Delegation.postOp(actualGasCost)                    │
│     ├─ 计算 aPNTs: (gasCost * 3500 * 1000) / 21             │
│     └─ transferFrom(OWNER, Paymaster, apntsAmount) ✅        │
│                                                              │
│  Result: 用户 aPNTs 减少，Paymaster 收到 aPNTs ✅            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
                   交易完成 🎉
```

---

## 💰 Gas Payment Scenarios

### Scenario 1: 用户有足够 aPNTs（当前测试账户）

```
前提条件:
- User has MySBT ✅
- User has aPNTs >= 10 ✅ (当前: 30 aPNTs)
- Delegation enabled ✅

流程:
1. validateUserOp()
   ├─ SBT check: ✅ Pass
   ├─ Min balance: 30 >= 10 ✅ Pass
   ├─ Calculate: need 166.67 aPNTs for 0.001 ETH gas
   ├─ Balance check: 30 >= 166.67 ❌
   └─ WAIT... 30 < 166.67!

实际情况:
- 如果 gas 费用需要 166.67 aPNTs，但用户只有 30 aPNTs
- validateUserOp() 会返回 3 (Insufficient aPNTs)
- 然后 Paymaster 赞助 gas ✅
- 用户 aPNTs 不变
```

### Scenario 2: 用户有大量 aPNTs (>200)

```
前提条件:
- User has 500 aPNTs
- Gas cost: 0.001 ETH = 166.67 aPNTs

流程:
1. validateUserOp()
   ├─ SBT check: ✅
   ├─ Min balance: 500 >= 10 ✅
   ├─ Need: 166.67 aPNTs
   ├─ Balance: 500 >= 166.67 ✅
   └─ Approve Paymaster for 166.67 aPNTs

2. Execute transaction ✅

3. postOp()
   ├─ Calculate: 166.67 aPNTs
   └─ Transfer: User → Paymaster (166.67 aPNTs)

Result:
- User aPNTs: 500 → 333.33 ✅
- Paymaster aPNTs: +166.67 ✅
- User pays with aPNTs! 🎉
```

### Scenario 3: 用户 aPNTs < 10

```
前提条件:
- User has 5 aPNTs (< 10 minimum)

流程:
1. validateUserOp()
   ├─ SBT check: ✅
   ├─ Min balance: 5 < 10 ❌
   └─ return 2 (Balance < 10 aPNTs)

2. Paymaster sponsorship
   ├─ Paymaster.validateAndSponsor() checks
   ├─ Paymaster pays gas with ETH ✅
   └─ User aPNTs unchanged

Result:
- User aPNTs: 5 (no change)
- Paymaster ETH: decreases ✅
- Paymaster sponsors! 🎉
```

---

## 🔧 Key Constants

```solidity
// MinimalDelegationContract
uint256 public constant MIN_APNTS_BALANCE = 10 ether;  // 10 aPNTs
uint256 public constant ETH_PRICE_USD = 3500;          // $3500/ETH
uint256 public constant APNTS_PRICE_USD = 21;          // $0.021/aPNT

// Gas Calculation Formula
aPNTs = (ETH_wei * 3500 * 1000) / 21
```

---

## 📊 Function Call Sequence

### Enable Delegation (Setup)
```
User → MetaMask签名 → Network
  └─> DelegationFactory.deployDelegation(owner)
      └─> CREATE2 deploy MinimalDelegationContract
          └─> constructor(owner, paymaster, sbt, xpnts)
```

### Execute Transaction (With Paymaster)
```
User → Bundler → EntryPoint →
  ├─> Paymaster.validatePaymasterUserOp() ✅
  ├─> Delegation.validateUserOp() ✅
  ├─> Delegation.execute() ✅
  ├─> Target.call() ✅
  ├─> Paymaster.postOp() ✅
  └─> Delegation.postOp() ✅
```

---

## ✅ Summary

**Paymaster 核心功能**:
1. ✅ 验证用户资格（SBT + aPNTs）
2. ✅ 赞助 gas（用 ETH）
3. ✅ 收取 aPNTs 作为支付

**关键检查点**:
1. SBT 所有权 ✅
2. aPNTs 最小余额 >10 ✅
3. aPNTs 充足性检查 ✅
4. Gas 费用计算（基于价格） ✅

**Gas 支付逻辑**:
- 有足够 aPNTs (>计算值) → 用户用 aPNTs 支付 ✅
- aPNTs 不足 (<10 或 <计算值) → Paymaster 赞助 ✅

**当前测试账户**:
- 有 30 aPNTs
- 对于小额交易（<0.0006 ETH）可以用 aPNTs 支付
- 对于大额交易 Paymaster 会赞助 ✅

---

## 🎯 Testing Guide

### Test 1: Enable Delegation
```bash
# Visit http://localhost:8080
# Click "Enable Delegation"
# Sign in MetaMask
# Delegation deployed ✅
```

### Test 2: Transfer MockUSDC (Small Amount - Will use Paymaster)
```bash
# Click "Test Transfer"
# Input: recipient address, amount (10 USDC)
# Expected: Paymaster sponsors gas ✅
```

### Test 3: Check Balances
```bash
# Before: 30 aPNTs
# After small tx: 30 aPNTs (Paymaster sponsored)
# Need >200 aPNTs to pay for typical tx
```

**建议**: 给测试账户添加更多 aPNTs (>500) 以测试 aPNTs 支付场景！
