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
- [ ] sdk — 待回帖（两网 canonical 齐备）

### 🔴 主网发布门（测试网跑满 ~1 月后）
- [ ] 全 6 仓合约/服务主网部署 + 充值
- [ ] SDK canonical 主网地址齐备（参考 CC-18 两阶段经验）
- [ ] YAAA 配置切换：`ETH_RPC_URL` / `BUNDLER_RPC_URL` → 主网 `[配]`
- [ ] 生产配置核对（DB/密钥/Secrets）
- [ ] 安全：axios 漏洞缓解方案 + 各仓审计结论

---

## 各仓 Production-Ready（YAAA 已填；5 依赖仓待 CC-30 回帖后合并）

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

### repo:sdk — @aastar/sdk ⏳ 待回帖

YAAA 依赖期望：**两网 canonical 地址/ABI 齐备**、**breaking 版本收敛**、**发版节奏**、**admin/tokens/kms 子入口就绪**。→ YAAA 前后端都吃 SDK canonical。

---

## 跨仓依赖矩阵（随各仓回帖补全）

| 依赖方 → 被依赖 | kms | airaccount-contract | sp | dvt | sdk |
|---|:---:|:---:|:---:|:---:|:---:|
| **yaaa** | 登录/签名前置 | 账户合约地址 | gasless | T2/T3 BLS | canonical 地址/ABI |
| kms | — | ? | ? | ? | ? |
| airaccount-contract | ? | — | ? | ? | ? |
| sp | ? | ? | — | slash 消费 | ABI |
| dvt | BLS 托管? | ? | slash 提案 | — | ABI |
| sdk | ? | ABI track | ABI track | ABI track | — |

> `?` = 等对应仓回帖补全。

---

## 维护说明

- 本文档是**全生态发布单一真相源**，由 **repo:yaaa 维护**。
- 各仓把 production-ready 表**回帖到 CC-30**（`[repo:X] 工兵回复`），YAAA 汇进本文档并回填门/矩阵。
- 各仓**不再各自建文档**；一处维护，避免分叉。
- 汇总足够后据此排：**测试网发布 → 1 月观察 → 主网发布**。
