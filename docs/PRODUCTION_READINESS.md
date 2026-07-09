# Production Readiness — YAAA(Cos72) 正式版发布（全生态合并版）

> **单一真相源**。由 YAAA 维护，源头 = 协同任务 **CC-30** 各仓回帖，随回帖同步进来。
> 最后更新：2026-07-09。

## 核心目标

发布 **YAAA（现在就是 Cos72）正式版**：**先测试网（Sepolia）→ 稳定跑 ~1 个月（期间小修）→ 主网。**

⚠️ **测试网 vs 主网唯一区别 = 配置**（RPC / 合约地址 / env）—— 代码逻辑**零差异**。
每一项都标注：`[测]` 测试网就能发 · `[主]` 主网前必须补 · `[配]` 两网只差配置。

## 参与仓 + 依赖图（本期 6 仓）

```
                 ┌─────────────┐
                 │  repo:yaaa  │  = Cos72 正式版本体（前端 Next + 后端 Nest）
                 └──────┬──────┘
        依赖 ↓          ↓          ↓          ↓          ↓
   repo:kms   repo:airaccount-contract   repo:sp   repo:dvt   repo:sdk
  (TEE 密钥)     (账户合约)          (Paymaster)  (BLS 节点)  (集成包)
```

> 本期只这 6 仓。relay / launch / cos72(=yaaa) / docs(它依赖我们，最后更新) / idoris / sin90 / brood / goutou → 下一期。

---

## 发布门（汇总 checklist）

### 🟢 测试网发布门（Sepolia）
- [x] YAAA 核心流程（注册/建号/转账 T1-T3/gasless/买币）就绪
- [x] YAAA 治理页读+写上线（#425/#426/#427）
- [x] YAAA 测试绿（后端 41 单测 + 前端 10 e2e）
- [ ] kms — 待回帖（板子 + 两网密钥）
- [ ] airaccount-contract — 待回帖
- [ ] sp — 待回帖（CC-28 / slashPolicyAdmin 交权）
- [ ] dvt — 待回帖（CC-13 slash E2E）
- [x] sdk — 测试网无 SDK 阻塞（核心 API + 两网 testnet canonical(11155111/11155420) + ABI 全就绪）

### 🔴 主网发布门（测试网跑满 ~1 月后）
- [ ] 全 6 仓合约/服务主网部署 + 充值
- [ ] **SDK canonical 主网地址接入** —— 现 `CANONICAL_ADDRESSES` 只覆盖两个 testnet chainId，**mainnet(1/10) 未接入** → YAAA 从 SDK 取主网地址取不到；阻塞在 4 合约仓主网部署地址（照 CC-18 两阶段：合约仓部署 + CC-30 回帖地址 active → SDK 切 canonical + patch + 链上自验）
- [ ] SDK 主网前待办：CC-13 批B（Timelock 编排 wrapper）、#256 GuardChecker WA 预检复核、#163 buyGasless 修
- [ ] YAAA 配置切换：`ETH_RPC_URL` / `BUNDLER_RPC_URL` → 主网 `[配]`
- [ ] 生产配置核对（DB/密钥/Secrets）
- [ ] 安全：axios 漏洞缓解方案 + 各仓审计结论

---

## 各仓 Production-Ready（YAAA + sdk 已填；kms / airaccount-contract / sp / dvt 待回帖）

### repo:yaaa — 账户抽象全栈（=Cos72 本体） ✅ 已盘点

| 项 | 评估 | 状态 | 门 |
|---|---|---|---|
| 核心流程（注册/建号/转账 T1-T3/gasless/买币） | 转账旧 legacy-passkey 500 已解（WebAuthn ceremony）；tier3-composite 链上 LIVE PASS | ✅ | `[测]` |
| 治理配置页（CC-13） | 读+写上线（#425/#426/#427） | ✅（写侧真 E2E 等运营交权 timelock） | `[测]` |
| Paymaster 死代码 stub | 已删（#428） | ✅ | — |
| 测试 | 后端 41 单测 + 前端 10 Playwright e2e 绿 | ✅ | `[测]` |
| 网络切换 | 改 `ETH_RPC_URL`/`BUNDLER_RPC_URL` + SDK canonical 随链 | 🟡 发主网时 | `[配][主]` |
| 部署拓扑 | 先单机 cloudflared，未来 imx93 | 🟡 按此推进 | `[测]` |
| 生产配置核对 | DB_TYPE=postgres / 密钥 / 必填 env | 🟠 待逐项 | `[主]` |
| Security Audit（axios high via @ledgerhq） | 白名单放行，无 non-breaking fix | 🟠 记录+盯升级 | `[主]` |

Cos72 = YAAA 前端品牌；首页 `aastar-frontend/app/page.tsx`（#423）；交互 tour 在独立 repo `cos72-tour`（本期不含）。

### repo:kms — KMS/TEE 密钥（airaccount node） ⏳ 待回帖

YAAA 对它的依赖期望（供对方回帖时对照）：imx93 板子 **provision + 高可用**、**fail-closed API key**、**rpId/Origin 正确**、**两网密钥**。→ 是 YAAA 登录/签名/转账的前置。

### repo:airaccount-contract — 账户合约 ⏳ 待回帖

YAAA 依赖期望：**CC-27 改名(AAStarBLSKeyRegistry)落地**、**主网部署 + 审计**、**两网工厂/validator 地址**。

### repo:sp — SuperPaymaster 合约 + 经济层 ⏳ 待回帖

YAAA 依赖期望：**CC-28 xPNTs 滥发防护**、**slashPolicyAdmin 交多签/timelock**、**主网部署 + 充值**。→ 直接决定 YAAA gasless 能否上主网。

### repo:dvt — YetAnotherAA-Validator / DVT 节点 ⏳ 待回帖

YAAA 依赖期望：**CC-13 slash 真 E2E**、**节点(imx93)部署 + gossip**、**两网 validator/slot 注册**。→ YAAA 转账 T2/T3 BLS 聚合的前置。

### repo:sdk — @aastar/sdk ✅ 已盘点（0.39.4）

来源：CC-30 `[repo:sdk]`（2026-07-09）。**测试网现在基本可发（SDK 侧无阻塞）**；主网门见下表 + 发布门。

| 项 | 评估 | 状态 | 门 |
|---|---|---|---|
| 核心 API 面（role clients + gasless + DVT 注册 + slash 读 getter） | typed API 就绪，Sepolia/OP-Sepolia 链上 E2E LIVE PASS（CC-12/CC-17） | ✅ | `[测]` |
| 两网 canonical **testnet** 地址/ABI | Sepolia 11155111 + OP-Sepolia 11155420 进 `CANONICAL_ADDRESSES`；check:addresses/abi PASS | ✅ | `[测]` |
| 两网 canonical **mainnet** 地址 | ⚠️ 只覆盖两个 testnet chainId，**mainnet(1/10) 未接入** → YAAA 主网取不到；阻塞在 4 合约仓主网部署地址 | 🟠 主网前必补 | `[主][配]` |
| ABI 齐备 | check:abi PASS（SP 16/16 到 v5.4.2）；DVT AAStarBLSAlgorithm tracked；同名碰撞隔离(#301/#302)；ABI 与网络无关 | ✅ | `[测]=[主]` |
| Breaking 版本收敛 / 发版节奏 | 0.37→0.39 breaking 已收敛发布，节奏稳定 | ✅ | `[测]` |
| 子入口就绪 | admin/tokens/kms/operator/enduser/community/paymaster/identity/dapp re-export；slash 读 getter 随 0.39.1 | ✅ | `[测]` |
| slash 治理写侧（CC-13 批B：Timelock 编排 wrapper） | 读 getter 批A 已就位；写侧 wrapper 待开发（需 OZ TimelockController ABI 进 core） | 🟡 待开发 | `[主]` |
| #256 GuardChecker WebAuthn algId 预检 | algIdForTier 无 WA 分支疑阻断 Tier-3；tier3-composite E2E LIVE PASS 但预检路径主网前需复核 | 🟠 主网前必确认/修 | `[主]` |
| #163 buyGasless BuyIntent 签名 + relayer stuck pending | open，影响买币路径 | 🟠 主网前必补 | `[主]` |
| #176 Tier2/3 额外签名收集 + tier判定/限额查询 API | API 面缺失，测试网可发但功能不全 | 🟡 补全 | `[测→主]` |
| #220 upstream drift 告警 | 需跑 upstream-sync 核对 | 🟡 待核 | `[测]` |
| DVT 系列 issue 收尾(#285/#279/#274/#270) | 已上链交付，仅待关闭 | 🟢 housekeeping | `[测]` |

依赖：**被依赖** = @repo:yaaa（前后端吃 SDK canonical）、idoris。**SDK 依赖**（主网前需两网就绪）= @repo:airaccount-contract / @repo:sp / @repo:dvt（主网地址；SDK canonical mainnet 接入阻塞在它们主网部署）、@repo:kms（HTTP openapi，无破坏变更，仅升服务 + 回归）。

> ⚠️ 对 YAAA 的影响：YAAA「网络切换」那条假设"SDK canonical 随链切"——**仅 testnet 成立**；主网需 SDK 先接 mainnet canonical（阻塞在合约仓主网部署）。已并入主网发布门。

---

## 跨仓依赖矩阵（随各仓回帖补全）

| 依赖方 → 被依赖 | kms | airaccount-contract | sp | dvt | sdk |
|---|:---:|:---:|:---:|:---:|:---:|
| **yaaa** | 登录/签名前置 | 账户合约地址 | gasless | T2/T3 BLS | canonical 地址/ABI |
| kms | — | ? | ? | ? | ? |
| airaccount-contract | ? | — | ? | ? | ? |
| sp | ? | ? | — | slash 消费 | ABI |
| dvt | BLS 托管? | ? | slash 提案 | — | ABI |
| sdk | HTTP openapi | ABI track + 主网地址 | ABI track + 主网地址 | ABI track + 主网地址 | — |

> `?` = 等对应仓回帖补全。

---

## 维护说明

- 本文档是**全生态发布单一真相源**，由 **repo:yaaa 维护**。
- 各仓把 production-ready 表**回帖到 CC-30**（`[repo:X] 工兵回复`），YAAA 汇进本文档并回填门/矩阵。
- 各仓**不再各自建文档**；一处维护，避免分叉。
- 汇总足够后据此排：**测试网发布 → 1 月观察 → 主网发布**。
