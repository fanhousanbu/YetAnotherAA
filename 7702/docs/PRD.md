# 简单粗暴的prd
一步顺滑成为无Gas EOA！
无需ETH余额，完成任务，呼叫AAStar支付！
## 背景
1. 基于EOA测试账户（私钥在7702目录下的.env)
TEST_EOA1=0xE3D28Aa77c95d5C098170698e5ba68824BFC008d,TEST_EOA2=0x92a30Ef64b0b750220B2b3BAFE4F3121263d45b3
TEST_EOA1_PRIVATE_KEY, TEST_EOA2_PRIVATE_KEY

2. 完成一个单页面应用
- MetaMask自动连接，自动识别网络和账户，显示余额。
- 识别是否授权了代理，显示代理位置和源代码
- 没有代理的，提供Tasks（原型版），转发Twitter即可获得aPNTs，然后一键绑定极简不可升级的无Gas代理
- 获取MySBT，完成任务，获得积分
- 日常工具：批量转U给多个账户；解绑Delegation；无Gas mint NFT; 加密购物初体验：1000 Heros！

## demo 测试
1. 测试多个例子，分析EIP协议和多个研究文章，给出洞察
2. List
- https://github.com/MetaMask/7702-livestream-demo
- https://github.com/amiecorso/eip7702-viem-demo
- https://github.com/pimlicolabs/7702-userop-demo
- https://github.com/gelatodigital/gelato-eip-7702-demo
- https://github.com/pimlicolabs/7702-demo
- https://docs.pimlico.io/guides/eip7702/demo
- https://eips.ethereum.org/EIPS/eip-7702
- https://docs.pimlico.io/guides/eip7702
- https://github.com/mart1n-xyz/eip7702-viem-demo
- https://github.com/cqlyj/simple-eip-7702
- https://github.com/myronzhangweb3/erc7702-demo
- https://github.com/jooohneth/7702-demo


## 新能力
### 行为和gas
好的，这是一个非常深入的分析。基于我们之前的讨论和你提供的 Viem 文档，我们必须将 EIP-7702 相关的交易**分为两个完全不同的阶段**来分析，这一点至关重要：

1.  **阶段一：“安装/升级”交易** (即你发送的第一笔 EIP-7702 交易)
2.  **阶段二：“后续使用”交易** (在“安装”完成后，对这个 EOA 的所有后续调用)

---

### 📈 交易类型分析

#### 阶段一：“安装/升级”交易

这是你**设置、更改或移除** EOA 授权的交易。

* **交易类型：** `0x04` (EIP-7702 类型)。
* **核心内容：** 必须包含一个 `authorizationList` (授权列表)。
* **Viem 示例：** 在 Viem 文档中，步骤 4 `sendTransaction` 就是这个阶段。
* **作用：** 这笔交易的**唯一目的**是修改你 EOA 账户在以太坊状态中的 `code` 指针。
* **执行模式 (我们讨论过的)：**
    * **Self-Executing**：EOA **自己**作为 `from` 发送这笔 `0x04` 交易。`to` 地址是它自己。签名时必须使用 `executor: 'self'`。
    * **Relay Mode**：**Relayer** 作为 `from` 发送这笔 `0x04` 交易。`to` 地址是 EOA。签名时不使用 `executor: 'self'`。
* **一个细节：** 这笔“安装”交易本身也可以顺便执行一个函数（例如 Viem 示例中的 `initialize`）。

#### 阶段二：“后续使用”交易

这是当你的 EOA **已经被成功“升级”** 为一个智能合约代理（Proxy）之后，你（或任何人）如何与它交互。

* **交易类型：** **普通交易** (例如 `0x00` Legacy, `0x02` EIP-1559)。
* **核心内容：** **不再需要 `authorizationList`！**。
* **Viem 示例：** 在 Viem 文档中，步骤 5 `sendTransaction` (调用 `ping` 函数) 就是这个阶段。
* **作用：**
    * 你现在可以直接向你的 EOA 地址发送一笔**标准**的合约调用交易。
    * EVM 会检测到你的 EOA 地址现在有关联的 `code` (在阶段一设置的)，并执行那些代码。
    * 你的 EOA 此时的行为**与一个标准的代理合约（Proxy）完全相同**。

---

### 💸 Gas Fee 分析

我们同样用两个阶段来分析 Gas 由谁支付。

#### 阶段一：“安装/升级”交易 (高 Gas 消耗)

这笔交易**会比较昂贵**，因为它是一次“状态修改”操作。

* **Gas 消耗**：这笔 `0x04` 交易的 Gas 费会显著高于一次简单的 ETH 转账。它包括：
    1.  验证 `authorizationList` 中签名的成本 (密码学计算)。
    2.  交易附带额外数据的成本。
    3.  **最昂贵的成本：** 修改 EOA 账户的 `code` 指针。这本质上是一次 `SSTORE` (状态存储)，是 EVM 中最耗 Gas 的操作之一。
    4.  首次执行函数（如 `initialize`）的 Gas 成本。

* **Gas 支付者：**
    * **Self-Executing 模式**：**EOA 自己支付**所有 Gas 费。此模式**不支持** Gas 代付，它的目的是为了让 EOA 自己执行批量操作。
    * **Relay Mode 模式**：**Relayer 支付**所有 Gas 费。这就是此模式的**核心目的**：实现 Gas 代付（Sponsorship）。

#### 阶段二：“后续使用”交易 (常规 Gas 消耗)

在 EOA 升级后，Gas 模型就变得和普通智能合约一样了。

* **Gas 消耗**：
    * Gas 成本 = (标准交易的固定成本) + (代理逻辑的少量开销) + (你调用的实际函数，如 `ping` 或 `batchTransfer` 的执行成本)。
    * 这与调用一个 Safe、Argent 或任何其他智能合约钱包的 Gas 成本基本相同。

* **Gas 支付者：**
    * **谁 `from` (发起) 交易，谁就支付 Gas。**
    * 在 Viem 示例的步骤 5 中，`walletClient` (代表 Relayer) 向 EOA 发送交易来调用 `ping`，那么 **Relayer 支付 Gas**。
    * 如果 EOA **自己**向**自己**发送交易来调用 `ping`，那么 **EOA 支付 Gas**。
    * 如果一个**完全无关的第三方**（比如我）向你的 EOA 发送交易来调用 `ping`，那么**我支付 Gas**。

* **那后续使用还支持“代付”吗？**
    * **可以，但与 EIP-7702 无关了。**
    * 此时你的 EOA 已经是一个智能合约代理了。如果想让“后续使用”也实现 Gas 代付，那么你在“阶段一”授权的那个合约（`Delegation.sol`）**必须自己支持元交易 (Meta-Transaction)** (例如 EIP-2771 规范)。
    * 换句话说，EIP-7702 只是负责把你的 EOA“变成”一个合约。变成合约之后，如何实现 Gas 代付，就取决于那个合约本身的能力了。

Gas Units (Gas 消耗量)。

Gas Units：执行一个操作所需的工作量（固定的计算成本）。

Gas Price (Gwei)：你愿意为每单位工作量支付的价格（波动的市场价格）。

总费用 (ETH) = Gas Units × Gas Price

交易场景,交易类型,大致 Gas Units (估算),主要 Gas 消耗点,谁支付 Gas?
基准：标准 ETH 转账,0x02 (普通),"21,000 (固定值)",基础交易费。,交易发起者 (EOA)
阶段一：“安装/升级”(Viem 示例中的步骤 4),0x04 (EIP-7702),"非常高 (60,000 - 100,000+)","1. 基础费 (21k)2. 验证 authorizationList (密码学)3. data 数据 (e.g., initialize)4. SSTORE 存储修改 (最贵的，用于“安装”合约代码指针)",Self-Executing 模式:EOA 自己Relay 模式:Relayer (代付)
阶段二：“后续使用” (简单)(Viem 示例中的步骤 5),0x02 (普通),"中等 (30,000 - 50,000)","1. 基础费 (21k)2. 代理逻辑开销 (EVM 读取 code 并 DELEGATECALL)3. ping() 函数的执行 (e.g., EMIT LOG)",交易发起者 (任何人)
阶段二：“后续使用” (复杂)(例如批量 approve + swap),0x02 (普通),"高 (100,000 - 300,000+)",1. 基础费 (21k)2. 代理逻辑开销3. 批量合约的内部逻辑4. approve (SSTORE)5. swap (多个 SSTORE 和 CALL),交易发起者 (任何人)
### 能力，风险和安全分析
Delegator合约，作为一个中继，提供合约代码模板，帮助EOA账户具备合约的能力，例如批量交易、链式原子交易等合约账户的能力。
“EIP-7702 的核心是让 EOA 临时获得智能合约的能力（例如批量、原子化交易等）。基于此，它提供了两种执行路径：

自我执行 (Self-Executing)：EOA 自己支付 Gas 来使用这个新能力。

中继执行 (Relay Mode)：由第三方（Relayer）代付 Gas，来让 EOA 使用这个新能力。”

执行前：你的 EOA 是一个普通钱包（Externally Owned Account）。它在以太坊状态中的 code 字段是空的。你给它转账，它只能接收；你不能调用它上面的函数（因为它没有函数）。

执行后：当你（或 Relayer）成功执行了那笔 0x04 交易（Viem 文档中的步骤 4），你的 EOA 状态就永久地改变了。

它的 code 字段不再为空。

它现在“指向”了你所授权的那个合约（contractAddress）的代码。

从这一刻起，你的 EOA 表现得就像一个代理合约（Proxy）。

这个授权是一次性还是永久的？
这要看你问的是“授权书”还是“授权的效果”：

“授权书”（Authorization）：你签名的那条消息（authorization 变量）是一次性的。它在步骤 4 的 sendTransaction 中被使用并“消耗”掉，用来完成“附身”这个动作。

“授权的效果”（Delegation）：这个“附身”状态是持久的（Persistent）！它会一直保持，直到你主动更改它。

你的 EOA 可以处于以下几种状态：

状态 1：普通 EOA（默认）

code 字段为空。

只能收发 ETH/Token。

状态 2：已指定合约（执行 EIP-7702 之后）

code 指向 Delegation.sol 合约。

现在向这个 EOA 发送调用 ping() 的交易，会触发 Delegation.sol 的 ping 函数。

这个状态是持久的。

状态 3：解除指定（重置回 EOA）

EIP-7702 规范允许你通过授权一个“空地址”（0x000...000）来清空这个 code 指针。

执行后，你的 EOA 会重新变回“状态 1”。

这个“重置”动作同样需要一笔 0x04 交易（可以 Self-Executing 或 Relayed）。

状态 4：更改指定

你可以签署一个新的 authorization，指向一个全新的、不同的合约（比如 BatchTransfer.sol）。

执行后，你的 EOA 的 code 指针就会从 Delegation.sol 覆盖成 BatchTransfer.sol。

这个状态也是持久的。

作恶可能：
中继执行：你引入了“中继者”这个第三方。

审查风险：中继者可以决定不打包你的交易（比如因为你给的代付手续费太低）。

时效性风险：你依赖中继者尽快把你的交易发出去。如果中继者宕机或延迟，你的操作（比如抢购 NFT）可能会失败。

中继者风险（对 Relayer 而言）：Relayer 支付了 Gas，但他需要（通过链下或链上逻辑）确保能收到你的“报酬”（比如你支付的 USDC）。如果你的授权操作最终失败，Relayer 依然支付了 Gas，他可能会亏损。
