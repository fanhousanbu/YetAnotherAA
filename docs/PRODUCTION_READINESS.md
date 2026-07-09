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
- [x] kms — 测试网就能发（v0.28.1，E2E 41/41 绿，只差 config→Sepolia）；板子明后天到货即部署
- [x] airaccount-contract — 测试网 beta 可发（v0.27.0 Sepolia，900 forge + 16 阶段 E2E 全绿）；⚠️ verify 9 pending 待补
- [x] sp — SP 侧零阻塞可支撑 YAAA 测试网发布（V5.4.2 + CC-28 滥发防护 + CC-29 LivenessRegistry 全在 Sepolia，1156 测试绿）
- [ ] dvt — 待回帖（CC-13 slash E2E）
- [x] sdk — 测试网就绪，**已发 0.40.0**（独立项 G2/G3/G4/G6/G7/G9-part1/G10 全清零，门禁全绿，core 471 + airaccount 872 测试）

### 🔴 主网发布门（测试网跑满 ~1 月后）
- [ ] **主网 V3→V5 全栈重部署（G1，SDK 实测的头号主网阻塞）** —— OP-Mainnet(chain 10) canonical 地址虽在，但链上是**旧 V3 栈**（SuperPaymaster-3.2.2 / Registry-3.0.2），SDK/测试网是 **V5.4.2** → @repo:sp / @repo:airaccount-contract / @repo:dvt 把 V5.4.2 全栈部署到 OP 主网 → SDK 切 canonical + `version()==5.4.2` 链上自验（CC-18 两阶段）
- [ ] DVT 主网/本地 anvil 节点（G5，`DEFAULT_DVT_NODES` 仅 Sepolia）+ xPNTs 滥发防护主网部署（G3 真生效）+ SDK 剩余主网前项（G8 #163 buyGasless / #176 part2 Tier-3 guardian ECDSA 收集）
- [ ] airaccount-contract 主网 GA：**外部安全审计(#29，GA 硬门禁)** + 主网部署脚本/Safe/keystore + verify 补齐（@repo:airaccount-contract + jason）
- [ ] SP：slashPolicyAdmin/owner **交社区 Safe（CC-31，`0x51eDf11f…`）** + aPNTs 主网充值 + 外部审计（@repo:sp + jason）—— SP runbook 已就位（PR #351，一条命令部署）；CC-31 同时解锁 YAAA 治理写侧 E2E（#427）
- [ ] KMS 硬件安全根基：**#99（RPMB+secure boot+strict flip）/ #50（防回滚 key）/ #127（最终安全复审）/ #128（生产密钥保管+事故响应）** 一趟 TA 重刷 + 一轮对抗审查（@repo:kms）；评估 KMS 单点/异地节点
- [ ] YAAA 配置切换：`ETH_RPC_URL` / `BUNDLER_RPC_URL` → 主网 `[配]`
- [ ] 生产配置核对（DB/密钥/Secrets）
- [ ] 安全：axios 漏洞缓解方案 + 各仓审计结论

---

## 各仓 Production-Ready（YAAA + sdk + airaccount-contract + sp + kms 已填；dvt 待回帖）

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

### repo:kms — KMS/TEE 密钥（airaccount node） ✅ 已盘点（v0.28.1）

来源：CC-30 `[repo:kms]`（`5e92032a`，2026-07-09；本仓 doc）。双发布线：`airaccount-kms-*`（独立密钥/签名服务）+ `airaccount-node-*`（KMS+DVT 二合一）。**测试网现在就能发**（0.28.1 只差 config 指向 Sepolia）；E2E 41/41 全绿。

| 项 | 状态 | 门 |
|---|---|---|
| 核心 KMS API（CreateKey/Sign/Grant/Revoke） | ✅ | `[配]` |
| WebAuthn strict challenge-binding(#49) / fail-closed 认证(#145) / Stats XSS+UTF-8(#144) / E2E 签名一致性(#68,41/41) / 社区上手门户 | ✅ | `[测]` |
| KMS+DVT 二合一基线（CC-22）+ Variant B DVT BLS TEE 托管（CC-24，PR#153 真机全绿） | ✅ KMS 侧 | `[测]`（待 @repo:dvt 确认 build 路径 + 轻接入）|
| #99 硬件安全根基（RPMB+secure boot+strict flip）/ #50 RPMB 防回滚 / #127 主网前最终安全复审 / #128 生产密钥保管+事故响应 | 🔴 主网前必补 | `[主]` |
| #122 CA/TA 一致性 CI 门 / #37 远程证明(Phase1) | 🟡 非阻塞 | `[测]` |
| NXP NDA 厂商根（战略改「可复现+透明⊕DVT」） | ⚪ 不阻塞 | — |

生产拓扑（社区条件受限版）：**KMS 1 份**（最稳一块板，同板 co-located DVT#1）+ **DVT 3 = 2-of-3 门限**（新 MX93=KMS+DVT#1 / 当前主板=DVT#2 / DK2=DVT#3）。⚠️ KMS 单份=可用性单点且与 DVT#1 同板、三板同地点无隔离 → **testnet 可接受**，主网前靠 #128 社恢复兜底 + 评估异地节点。

依赖：**被依赖（已就绪）** = @repo:dvt（`127.0.0.1:3100` signer 契约 `POST /sign`→EIP-2537 256B 已实现）、@repo:yaaa（账户验证/签名）、@repo:airaccount-contract（isValidOwnerAuth）。**依赖** = @repo:dvt（v1.9.0 arm64 板 build CC-22 + TEE 托管 CC-24 + 发 v1.10.0）、@repo:sp（applyBLSAggregator #285、slash #139）、@repo:airaccount-contract（合并部署后一次性链上重注册 TEE 新 BLS pubkey）、@repo:sdk（Sepolia 地址同步 CC-12/CC-19）。

> 关键：**KMS 测试网就绪** —— 硬件板明后天到货即部署。到货前软件侧**已合入 main**（`2e9e5afe`）：#122 CA/TA 门加固（PR #166，Codex 对抗 review + 3 Low 全修）、3-node 拓扑 profiles + runbook + readiness（PR #167，填好 Sepolia validator `0x539B96…`/EntryPoint v0.7，一键切两网）、DK2 部署已交接 @repo:dvt。**SP 依赖（#285 applyBLSAggregator / #139 slash）已确认闭环** → KMS 非硬件依赖只剩 **@repo:dvt**（DK2 脚本 / CC-22 build+validator / CC-24 TEE 托管 / 发版）+ 主网前 @repo:airaccount-contract 一次性重注册 TEE 新 BLS pubkey。主网 = 补 #99/#50/#127/#128（一趟 TA 重刷 + 对抗审查），代码零改动。

### repo:airaccount-contract — 账户合约 ✅ 已盘点（v0.27.0）

来源：CC-30 `[repo:airaccount-contract]`（`7a0a6d29`，2026-07-09；本仓 PR #183）。**测试网 beta 现已可发**（v0.27.0 Sepolia 部署+验证，900 forge 测试全绿 + 16 阶段 E2E）；主网 GA 阻塞见下。

| 项 | 评估 | 状态 | 门 |
|---|---|---|---|
| 核心账户合约栈 | v0.27.0 Sepolia 部署+验证，测试全绿 | ✅ | `[测]=[主]` |
| CC-27 改名 AAStarBLSKeyRegistry | PR #182 已合并，CI 绿；随 release bump 部署 | 🟡 待发版 | `[主]` |
| 切 tagged release（bump + 落地改名） | 待发版 | 🟡 | `[测]→[主]` |
| **外部安全审计（#29）** | 未做，**GA 硬门禁** | 🔴 未开始（jason） | `[主]` |
| Etherscan verify | Sepolia 2/11，9 pending（foundry source path 问题）；key 已有 | 🟠 未完成 | `[测]+[主]` |
| 主网合约部署 | 脚本 `deploy-op-mainnet-alpha.ts` 待建 | 🔴 未开始 | `[主][配]` |
| 主网 e2e_account（CC-22） | 主网 impl 部署后手工 mint 回填（智能合约账户，非 EOA） | 🟠 gated | `[主][配]` |
| OP 主网 Gnosis Safe owner（#135/CC-31） + GA ops（EntryPoint stake + transferOwnership） | 未部署/未做 | 🔴 需配置 | `[主]` |
| 生产 DVT 节点 nodeId/pubkey | CC-22 Variant B：KMS-TEE 托管、key-less node_state（主网不放裸 BLS 私钥） | 🟠 待 @repo:dvt/@repo:kms | `[主]` |
| aPNTs 主网地址 | TBD | 🟠 待 @repo:sp | `[主][配]` |
| KI-7 P256/EIP-7212 | 目标 OP 有 precompile（已决策选 OP，非以太坊主网） | ✅ | `[配]` |
| 文档刷新（DEPLOYMENT/known-issues） | 本轮已刷 | 🟢 | `[测]` |

延后非阻塞：#136/#149/#21/#20（gas/字节码）· #161/#133/#26/#27/#25/#24/#138（功能）· 跟踪伞 #112/#67/#66/#137；代码仅 1 处 TODO（KI-9 executeBatch，设计约束）。无 open PR。

依赖：**被依赖** = @repo:yaaa（账户合约两网地址）、@repo:sdk（canonical 工厂/validator 主网地址，CC-18 两阶段）、@repo:kms/@repo:dvt（isValidOwnerAuth 契约 CC-23 已入 INTERFACES + 主网 e2e_account CC-22）。**依赖** = @repo:dvt（主网 validator + 生产节点 nodeId/pubkey）、@repo:kms（rpId/Origin 两网 + DVT 密钥 KMS provision）、@repo:sp（aPNTs 主网地址）、jason/配置（OP 主网 Safe / RPC / bundler / keystore / **外部审计**）。

**结论**：测试网 beta ✅ 现可发；主网 GA 🔴 阻塞 = ①审计(#29) ②主网部署(脚本+Safe+keystore) ③跨仓两网就位(@dvt/@sp/@kms) ④verify 补齐。**可独立先做**（已排）：切 release + 落地改名、建主网部署脚本骨架、修 verify path、刷文档。

### repo:sp — SuperPaymaster 合约 + 经济层 ✅ 已盘点（v5.4.2）

来源：CC-30 `[repo:sp]`（`bc90cc99` + `8195df64` 进度，2026-07-09；本仓 PR #350 合并 + #351）。SP 是依赖枢纽。**测试网 🟢 SP 侧零阻塞**；**SP 独立项全部落地**（主网 runbook + config + CC-14 命名 + CheckVersions chain-10 修，PR #351）——主网剩纯外部门禁，"审计一过一条命令上主网"。**#285 applyBLSAggregator 已完成**（`BLS_AGGREGATOR==0xF51c…8B13`，Sepolia 链上验，KMS/DVT 可用新聚合器）。

| 项 | 评估 | 状态 | 门 |
|---|---|---|---|
| 核心 V5.4.2 全栈（SP/Registry/xPNTs/BLS/DVTValidator） | Sepolia 部署，1156 测试绿 | ✅ | `[测]=[主]` |
| CC-28 xPNTs 滥发防护（isOverIssued） | Sepolia 已部署验证（#344/#345） | ✅ | `[测]` |
| CC-29 LivenessRegistry | Sepolia `0x02d841F7905aFb4424DBA71680D27C0F75d36BE7` | ✅ | `[测]` |
| **G1 主网 V3→V5 全栈重部署** | 🔴 OP 主网仍 SP-3.2.2/Registry-3.0.2（**头号阻塞**，与 SDK 判断一致） | 🔴 | `[主]` |
| 主网 config + 部署 runbook | ✅ SP 侧就绪：`config.op-mainnet.json`=权威 V5，`./deploy-core op-mainnet --fresh-deploy`=V5.4.2 全栈一条命令（runbook PR #351）；待外部门禁 | 🟡 | `[主][配]` |
| **slashPolicyAdmin/owner 交社区 Safe（CC-31）** | 现 EOA → 交社区 Safe `0x51eDf11f…`（SDK 已加 canonical COMMUNITY_SAFE，随 G1 主网地址一起落） | 🟠（GA） | `[主]` |
| aPNTs 主网地址 + SP 充值 | 待做（随 SP 主网部署） | 🟠 | `[主][配]` |
| 外部安全审计（V5.4.2 全栈） | 待 jason（GA 硬门禁） | 🔴 | `[主]` |
| G10 config 去冗余 | ✅ SP 侧（PR #351：op-mainnet=权威 V5，optimism.json 标 legacy-V3 禁读）—— 与 SDK 0.40.0 对齐（SDK 删快照，两边结论一致不冲突） | `[配]` |

下一期（非 YAAA 正式版阻塞）：架构重构 #251-#254/#211/#212 · 功能 #300/#237/#217 · 债 #321/#299/#286/#343/#332 · 测试 #257。审计 H/M 批次已闭，剩 #328 Low。无 open PR。

依赖：**被依赖** = @repo:yaaa（gasless）、@repo:sdk（ABI/主网地址）、@repo:airaccount-contract（aPNTs 主网地址随 SP 主网部署）、@repo:dvt（CC-29 LivenessRegistry 已给 + CC-13 slash 流水线就绪）。**依赖** = @repo:dvt（主网 validator + 生产节点，BLS quorum 是 slash 前置）、@repo:airaccount-contract（主网工厂/validator）、@repo:kms（间接：DVT 节点密钥）、jason（OP 主网 Safe CC-31 已有 + RPC + keystore + 外部审计）。

> ⚠️ 对 YAAA 的直接影响：gasless **测试网已就绪**（可发）；**主网 gasless** 等 G1 + **slashPolicyAdmin 交多签（CC-31）** + aPNTs 充值。其中 CC-31 正是 YAAA 治理写侧 E2E（#427）在等的那次交权 —— 两件事同一步。

### repo:dvt — YetAnotherAA-Validator / DVT 节点 ⏳ 待回帖

YAAA 依赖期望：**CC-13 slash 真 E2E**、**节点(imx93)部署 + gossip**、**两网 validator/slot 注册**。→ YAAA 转账 T2/T3 BLS 聚合的前置。

### repo:sdk — @aastar/sdk ✅ 已盘点（0.40.0，独立项全部落地并发布）

来源：CC-30 `[repo:sdk]`（`81f3592c` 修正 + `1f63acba` + `353eb50e` 进度，2026-07-09）。三环境实跑门禁 + 链上 `version()` 核验（非纸面）。**已发 `@aastar/sdk 0.40.0`（PR #303/#304，Codex 三轮 APPROVE，npm 已验）**：SDK 所有**不依赖上游主网部署**的独立项全部清零。

**🔴 主网头号阻塞 G1（链上实测）**：OP-Mainnet(chain 10) canonical 地址虽在（`listSupportedChainIds()=[10,11155111,11155420]`，check:addresses PASS），但**链上是旧 V3 栈**（SuperPaymaster-3.2.2 / Registry-3.0.2），而 SDK ABI + 测试网是 **V5.4.2** → 测试网(V5)开发后切主网(V3)会 ABI/行为不兼容。**主网必须 V5.4.2 全栈重部署** → @repo:sp / @repo:airaccount-contract / @repo:dvt。

> 更正上一帖：mainnet(10) **已在** canonical（非"未接入"）；真正问题是它指向旧 V3 部署（G1）。

| Gap | 项 | 状态 | 门 | owner |
|---|---|---|---|---|
| G1 | 主网 V3→V5 全栈重部署（头号主网阻塞） | 🔴 待 | `[主]` | @sp/@airaccount-contract/@dvt |
| G2 | check:abi RED（LivenessRegistry + AAStarBLSKeyRegistry） | ✅ 已修 | `[测]` | sdk（branch `feat/abi-sync-cc28-cc29-liveness`）|
| G3 | check:abi-drift RED：CC-28 xPNTs 滥发防护（issuanceCap/isOverIssued/capRatioBps…） | ✅ ABI 面已同步 | `[主]` | sdk；主网真生效需 @sp 部署 |
| G4 | Paymaster/Registry 漂移（GasCostExceedsCap / SBTStatusSyncFailed） | ✅ 已修 | `[测]` | sdk |
| G5 | DVT 节点只接 Sepolia（`DEFAULT_DVT_NODES` 仅 11155111；无 mainnet/anvil）→ Tier-2/3 联签本地/主网取不到节点 | 🔴 待 | `[主][配]` | @dvt（主网 validator+nodeId+本地端点）|
| G6 | CC-13 批B slash Timelock 编排 | ✅ 已发（v0.39.3） | `[主]` | sdk |
| G7 | #256 GuardChecker WA algId | ✅ 已发（v0.37.1，issue closed） | `[主]` | sdk |
| G8 | #163 buyGasless relayer stuck | 🟠 主网前必补 | `[主]` | sdk |
| G9 | #176 ERC20 tier判定/限额 API（part1） | ✅ 0.40.0（getTokenGuardState 真读 + resolveTokenTier + 修 token/account tier 潜伏 bug + tier 边界）；part2 Tier-3 guardian ECDSA 收集待（需 guardian E2E） | `[测→主]` | sdk |
| G10 | config.op-mainnet vs optimism 去冗余 | ✅ 0.40.0（删 stale config.optimism.json，chain-10 唯一权威 = config.op-mainnet.json） | `[配]` | sdk |

门禁实跑（0.40.0，独立项 G2/G3/G4/G6/G7/G9-part1/G10 全清零）：check:abi ✅ / check:abi-drift ✅ / abi:sync ✅ / check:addresses ✅ / check:stubs ✅ / build ✅；单测 core 471 + airaccount 872 ✅。⚠️ ABI/地址 sync 是**移动快照** —— 上游主网 V5 部署 / xPNTs 还在改，SDK 会在上游稳定后再跑一遍 abi-sync + address-sync + 链上 `version()` 自验。

依赖：**被依赖** = @repo:yaaa（前后端吃 SDK canonical）、idoris。**SDK 依赖**（主网前需就绪）= @repo:airaccount-contract / @repo:sp / @repo:dvt（**主网 V5 部署地址**）、@repo:kms（HTTP openapi，无破坏变更）。

**SDK 结论**：测试网 ✅ 就绪（0.40.0 已发，独立项全清零）；主网 🔴 阻塞 G1（主网仍 V3）+ G5（DVT 主网节点）+ G3 主网生效（xPNTs 部署）+ G8 #163 + #176 part2。已与 SP 对齐（`519cc3d8`）：G10 一致、G1 handoff 协议确认（SP 部署回帖地址 → SDK 接 `CANONICAL_ADDRESSES[10]` + 链上 `version()==5.4.2` 自验 → 发 patch）；SP core ABI 已冻结在 5.4.2（"移动快照"对 SP 收窄为**只剩地址**）；CC-31 社区 Safe `0x51eDf11f…` 已加 canonical `COMMUNITY_SAFE`，随 G1 主网接入一起落。

> ⚠️ 对 YAAA 的影响：YAAA「网络切换」看似"改 RPC 即可"，但 **SDK 主网 canonical 指向旧 V3** → YAAA 切主网前必须等上游 V5 全栈主网部署 + SDK 切 canonical + `version()==5.4.2` 自验。已并入主网发布门（G1）。

---

## 跨仓依赖矩阵（随各仓回帖补全）

| 依赖方 → 被依赖 | kms | airaccount-contract | sp | dvt | sdk |
|---|:---:|:---:|:---:|:---:|:---:|
| **yaaa** | 登录/签名前置 | 账户合约地址 | gasless | T2/T3 BLS | canonical 地址/ABI |
| kms | — | isValidOwnerAuth+重注册 | applyBLSAgg/slash | build路径/TEE接入/v1.10 | Sepolia 地址同步 |
| airaccount-contract | rpId/Origin+密钥 | — | aPNTs 地址 | validator+节点 | — |
| sp | (间接)DVT密钥 | 主网工厂/validator | — | validator+节点(slash 前置) | ABI |
| dvt | BLS 托管? | ? | slash 提案 | — | ABI |
| sdk | HTTP openapi | ABI track + 主网地址 | ABI track + 主网地址 | ABI track + 主网地址 | — |

> `?` = 等对应仓回帖补全。

---

## 维护说明

- 本文档是**全生态发布单一真相源**，由 **repo:yaaa 维护**。
- 各仓把 production-ready 表**回帖到 CC-30**（`[repo:X] 工兵回复`），YAAA 汇进本文档并回填门/矩阵。
- 各仓**不再各自建文档**；一处维护，避免分叉。
- 汇总足够后据此排：**测试网发布 → 1 月观察 → 主网发布**。
