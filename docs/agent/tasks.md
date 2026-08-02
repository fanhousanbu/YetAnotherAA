# YetAnotherAA 任务台账 — Task

> - 前置：[`roadmap.md`](roadmap.md)（M→F）
> - 每个 Task 自包含，可独立开发与验收。**验收标准必须可机器验证**（跑命令能判定通过与否）。
> - 状态取值：`BACKLOG` · `READY` · `IN_PROGRESS` · `BLOCKED` · `PR_OPEN` ·
>   `CHANGES_REQUESTED` · `APPROVED` · `DONE`
> - 记录日期：2026-08-02

---

## F1.1 — Beta 阻塞项收口

> **核查前提**：`BETA_READINESS_ASSESSMENT.md`
> §4 的 must-do 清单写于 2026-07-02。建立本台账时逐条对着 master 的代码重新核过，其中 4 条已经落地——记为 DONE 并留证据，而不是让它们在清单里继续挂着假装是待办。

### T1.1.1 建号走 v0.23 passkey-at-birth + 画像 tier 配置 `DONE`

- **优先级**：high
- **目标**：新用户建出来的账户是「已部署 + 有 owner
  passkey + 有 tier 限额」的，而不是 legacy 反事实账户
- **证据**：master `aastar-frontend/components/CreateAccountDialog.tsx:169-199`
  已改调 `prepareCreateWithPasskey` → `submitCreateWithPasskey` 并传
  `initialTokenConfigs`； `aastar-frontend/lib/tier-profiles.ts` 提供
  `resolveTierProfile`。这直接闭合了 `docs/CREATE_FLOW_BETA_BUG.md`
  记录的两个 root cause。
- **验收命令**：`git grep -n "prepareCreateWithPasskey" -- aastar-frontend/components/CreateAccountDialog.tsx`（有输出即已切换）
- **备注**：`CREATE_FLOW_BETA_BUG.md` 文档本身尚未标注「已修复」，见 T1.1.5。

### T1.1.2 修 `operator/status` 500（`hasRole(undefined)`） `DONE`

- **优先级**：high
- **目标**：未注册/缺参调用 `GET operator/status` 返回 200 + 空状态，而非 500
- **证据**：master `aastar/src/operator/operator.controller.ts:38-67`
  已有显式 guard 与空状态返回
- **验收命令**：`npm test -w aastar -- operator`

### T1.1.3 服务存活监控与告警 `DONE`

- **优先级**：high
- **目标**：cos72 跑在单台笔记本 + launchd 上，进程挂了要有人知道
- **证据**：`scripts/ops/yaa-liveness.sh` +
  `scripts/ops/io.aastar.yaa-monitor.plist`（PR #443 起纳入版本管理）
- **验收命令**：`test -x scripts/ops/yaa-liveness.sh && bash -n scripts/ops/yaa-liveness.sh`

### T1.1.4 社会恢复：链上验证或降级标注 `DONE`

- **优先级**：high
- **目标**：48 小时 recovery timelock 的安全属性在链上被证明
- **证据**：`docs/SOCIAL_RECOVERY_TEST_REPORT.md`（Sepolia，2026-07-02，headless
  e2e 证明 `executeRecovery()` 在 48h 前 revert）；后续加固 PR
  #441（执行前校验链上 proposal）、#446/#449（按爆炸半径排序恢复后的 DB 写入）
- **验收命令**：`npm test -w aastar -- guardian`
- **遗留**：TOCTOU 窗口仍开着 → issue #447 → 转 T3.5.1 跟踪

### T1.1.5 把已闭合的 beta 阻塞项回写进评估文档 `READY`

- **优先级**：mid
- **目标**：`BETA_READINESS_ASSESSMENT.md` §4 / §6 与 `CREATE_FLOW_BETA_BUG.md`
  与代码现状对齐，别让文档骗人
- **开发范围**：在两份文档里标注已闭合项 + 指向本台账；`CREATE_FLOW_BETA_BUG.md`
  顶部加 RESOLVED 头
- **明确不做**：不改任何代码逻辑，不重写评估结论
- **依赖**：无（T1.1.1–T1.1.4 的结论已在本文件记录）
- **交付物**：两份文档的状态更新
- **验收命令**：`npm run format:check`
- **涉及文件**：`docs/BETA_READINESS_ASSESSMENT.md`、`docs/CREATE_FLOW_BETA_BUG.md`
- **风险/回滚**：纯文档，无风险

### T1.1.6 KMS 双板 HA（二号 imx93） `BLOCKED`

- **优先级**：high
- **目标**：消除 KMS 单点故障
- **阻塞原因**：**硬件依赖** —— 二号 imx93 到货 + 上架 +
  KMS 部署，不是本仓库代码能推进的
- **待决问题**：二号板到位后，YAA 侧是配双 KMS
  endpoint 故障转移，还是由上游 KMS 做 VIP/负载均衡？这决定要不要改
  `aastar/src/kms/`
- **依赖**：无（外部）

---

## F1.2 — 高优负向用例

### T1.2.1 解冻并跑通 transfer-replay e2e `READY`

- **优先级**：high
- **目标**：证明「已消费的 challengeId 重放被拒绝」，把 spec 从 BLOCKED 状态放出来
- **背景**：`aastar-frontend/e2e/transfer-replay.spec.ts` 头部注释把自己标为
  `BLOCKED by docs/CREATE_FLOW_BETA_BUG.md`（新账户第一笔转账 prepare 就失败）。该 bug 已由 T1.1.1 闭合 →
  **这个 spec 现在应该能跑了**，注释已过期
- **开发范围**：去掉过期的 BLOCKED 注释；实跑 spec；失败则修到通过或如实记录新的真实阻塞原因
- **明确不做**：不扩到 D1 表的其他用例（那是 T2.2.x）
- **依赖**：T1.1.1（已 DONE）
- **交付物**：可跑通的 `transfer-replay.spec.ts` + 证据记录
- **验收命令**：`npx playwright test e2e/transfer-replay.spec.ts --project=chromium`（在
  `aastar-frontend/` 下）
- **涉及文件**：`aastar-frontend/e2e/transfer-replay.spec.ts`
- **风险/回滚**：会在 Sepolia 真实发一笔小额转账，需要 funded 账户；失败不影响生产

### T1.2.2 JWT 401 鉴权负向用例 `READY`

- **优先级**：high
- **目标**：无 token / 过期 token
  / 篡改 token 访问受保护接口，一律 401，不泄漏内部错误
- **开发范围**：后端 e2e 覆盖 transfer / account / operator 三类受保护路由各一条
- **明确不做**：不做权限分级（role-based）测试，只做认证层
- **依赖**：无
- **交付物**：`aastar/test/` 下的 e2e spec
- **验收命令**：`npm run test:e2e -w aastar`
- **涉及文件**：`aastar/test/`、`aastar/src/auth/`
- **风险/回滚**：纯测试新增

### T1.2.3 余额不足 / passkey 取消负向用例 `DONE`

- **优先级**：high
- **证据**：PR #415
  `test(e2e): L3 negative transfer cases — insufficient balance + passkey cancel (CDP)`；spec 在
  `aastar-frontend/e2e/transfer-negatives.spec.ts`
- **验收命令**：`test -f aastar-frontend/e2e/transfer-negatives.spec.ts`

### T1.2.4 Guard 严格模式 / 每日限额真机复现 `BLOCKED`

- **优先级**：high
- **目标**：验证超限转账被强制升到 Tier 3、严格模式下受限操作被拦截
- **阻塞原因**：需要**真机 passkey 操作**（Face ID/Touch
  ID），CDP 虚拟认证器覆盖不到； `LAUNCH_READINESS_PLAN.md` 明确列为「用户负责」
- **待决问题**：是否接受用 CDP 虚拟认证器做降级验证（覆盖逻辑但不覆盖真实生物识别）？
- **文档**：`docs/test-manual/GRD-04-guard-write.md` 已就绪
- **依赖**：无（需人）

---

## F1.3 — Beta 范围闸门

### T1.3.1 未验证能力在 UI 上显式标 experimental `READY`

- **优先级**：high
- **目标**：beta 用户不会在不知情的情况下走进未验证路径
- **开发范围**：recovery、operator（准入未闭环）、非 v0.7
  EntryPoint 三处加 experimental 标识/说明；文案说明「beta 期间该能力未完成验证」
- **明确不做**：不禁用功能（只标注）；不做 feature flag 体系
- **依赖**：无
- **交付物**：前端标注 + i18n 文案两语齐全
- **验收命令**：`npm run i18n:check -w aastar-frontend && npm run type-check -w aastar-frontend`
- **涉及文件**：`aastar-frontend/app/recovery/`、`aastar-frontend/app/operator/`、i18n 文件
- **风险/回滚**：纯 UI，回滚即 revert

---

## F1.4 — 转账 UX 抢救项（来自废弃分支）

> **来源**：`feat/registry-portal-sdk` / `fix/portal-review-269`
> 两条分支已落后 master 134 个 commit，且改的是已被 `/tokens` 取代的
> `app/sale/page.tsx`，rebase 成本远高于重写。决策（2026-08-02，用户拍板）：**抢救特性、废弃分支**。分支删除前已打归档 tag，原始实现可用
> `git show <tag>` 取回，见各 Task 的「参考实现」。

### T1.4.1 AA26 智能 gas 估算 + 自动重试 `READY`

- **优先级**：mid
- **目标**：转账遇到 bundler
  AA26（gas 估算不足）时自动按温和倍率重试，并把实际 gas 展示给用户，而不是直接把报错甩给用户
- **开发范围**：在当前 master 的转账链路上重写；倍率沿用原分支结论（2x/3x 温和倍率，
  `verificationGasLimit` 3x 安全系数 + 150k 下限）
- **明确不做**：不改 paymaster 选择逻辑；不做全局重试框架
- **依赖**：无
- **参考实现**：`git show 3fba02d`（智能估算+自动重试+实际 gas 展示）、`git show 2a88aa3`（温和倍率 2x/3x）、`git show f172185`（verificationGasLimit
  3x + 150k 下限）——三个 commit 由 tag `archive/registry-portal-sdk` 保活
- **交付物**：转账重试逻辑 + 实际 gas 展示
- **验收命令**：`npm run type-check -w aastar-frontend && npm run lint -w aastar-frontend`
- **涉及文件**：`aastar-frontend/app/transfer/`、`aastar/src/transfer/`
- **风险/回滚**：**涉钱**
  —— 重试会提高 gas 上限，必须设硬上限防止无限抬价；重试次数与倍率都要有 cap，并在 PR 里写清最坏情况的 gas 上界

### T1.4.2 最近收款人下拉 `READY`

- **优先级**：low
- **目标**：转账页地址栏可以从最近收款人里选，减少手输地址出错
- **开发范围**：在当前 master 的地址簿/客户端存储基础上实现（地址簿已客户端化）
- **明确不做**：不做后端持久化（与纯前端迁移方向一致，见 F3.2）
- **依赖**：无
- **参考实现**：`git show f5e241e`（由 tag `archive/registry-portal-sdk` 保活）
- **交付物**：转账页最近收款人下拉
- **验收命令**：`npm run type-check -w aastar-frontend && npm run lint -w aastar-frontend`
- **涉及文件**：`aastar-frontend/app/transfer/`、客户端地址存储
- **风险/回滚**：纯 UI

---

## F2.1 — 运营者准入闭环

### T2.1.1 查 Step5 `deployAndRegisterPaymasterV4` revert 原因 `BACKLOG`

- **优先级**：mid
- **目标**：解码 revert，区分 GToken 不足 / 工厂地址 / 角色前置 / SDK 入口四类因
- **开发范围**：用 `simulateContract` 复刻该调用（含 ROLE_PAYMASTER_AOA 30 GT
  stake）并解码
- **依赖**：无
- **验收命令**：`npx playwright test e2e/operator-onboarding.spec.ts --project=chromium`（跑到 Step5 不再 Retry）
- **涉及文件**：`aastar-frontend/e2e/operator-onboarding.spec.ts`、`aastar-frontend/app/operator/deploy/`
- **风险/回滚**：**涉钱** —— 会消耗测试 EOA 的 ETH/GToken

### T2.1.2 补全 Step5–7 并断言链上结果 `BACKLOG`

- **优先级**：mid
- **依赖**：T2.1.1
- **验收命令**：`npx playwright test e2e/operator-onboarding.spec.ts --project=chromium`（跑到 StepComplete）

---

## F2.2 — 完整负向/异常矩阵

### T2.2.1 D1 转账/Guard 剩余用例 `BACKLOG`

- **优先级**：mid
- **目标**：`LAUNCH_READINESS_PLAN.md` §5
  D1 表里除 T1.2.1/T1.2.3/T1.2.4 之外的条目（金额边界、非法地址、过期 prepare）
- **依赖**：T1.2.1
- **验收命令**：`npm run test:e2e -w aastar && npx playwright test --project=chromium`

### T2.2.2 D2–D5 其余域负向用例 `BACKLOG`

- **优先级**：mid
- **依赖**：T2.2.1
- **验收命令**：同上

---

## F2.3 — Guardian 协签 UX 闭环

### T2.3.1 转账 Tier-3 guardian 协签 UX（issue #382 的 #3a） `BACKLOG`

- **优先级**：mid
- **目标**：转账触发 Tier-3 时的 guardian 协签交互闭环（提额侧 #3b 已由 PR
  #390 落地）
- **依赖**：T1.2.4（Guard 真机复现给出 Tier-3 强制升级的真实触发条件）
- **验收命令**：`npx playwright test e2e/transfer-tier3.spec.ts --project=chromium`
- **关联**：issue #382

---

## F2.4 — 多 EntryPoint 覆盖

### T2.4.1 v0.6 / v0.8 EntryPoint 路径验证 `BACKLOG`

- **优先级**：low
- **目标**：目前只验过 v0.7；补另外两个版本的建号+转账路径
- **依赖**：无
- **验收命令**：`npm run test:onchain`（带 EntryPoint 版本参数）

---

## F2.5 — 前端单测

### T2.5.1 前端关键路径单测起步 `BACKLOG`

- **优先级**：mid
- **目标**：`aastar-frontend` 目前 `npm test` 是一句 echo；至少覆盖 transfer /
  auth 的纯函数与状态逻辑
- **明确不做**：不做全量组件快照测试
- **依赖**：无
- **验收命令**：`npm test -w aastar-frontend`（不再是 echo，且通过）

---

## F2.6 — 主网冒烟

### T2.6.1 OP 主网 gasless 转账 + 买入各一笔 `BLOCKED`

- **优先级**：high
- **阻塞原因**：**真实资金 + 发布闸门** —— 按 `LAUNCH_READINESS_PLAN.md`
  必须在 M1/M2 全绿后、发布前才做
- **待决问题**：主网测试账户与预算额度由谁准备、上限多少
- **依赖**：M1 全部 + T2.1.2 + T2.2.2
- **风险/回滚**：**真实资金**，不可回滚

---

## F3.1 — API-key 模型 / KMS Origin

### T3.1.1 浏览器直连的 API-key 授权模型 `BACKLOG`

- **优先级**：mid
- **目标**：让浏览器能在不经过自建后端的前提下安全调用 bundler + KMS
- **依赖**：上游 KMS 侧 Origin 解析行为（见 memory：KMS 按 Origin 解析 rpId）
- **验收命令**：待细化时补（当前写不出可验证命令 → 保持 BACKLOG，不许直接转 READY）

---

## F3.2 — 纯前端零后端迁移

### T3.2.1 解冻 PR #400 `BLOCKED`

- **优先级**：mid
- **目标**：把 `refactor/pure-frontend` 从 WIP·PAUSED 推进到可合并
- **阻塞原因**：分支自己标注 PAUSED，卡在 API-key/KMS-Origin 基建（T3.1.1）
- **待决问题**：beta 是否需要把已有后端数据（地址簿/token 列表/paymaster 列表）一次性导入 localStorage，还是 beta 从零开始？这个决定影响迁移是否要写导入器
- **依赖**：T3.1.1
- **证据**：PR #400（draft，8 commits ahead / 43 behind master）

---

## F3.3 — 依赖存量监控

### T3.3.1 paymaster / EntryPoint deposit 余额告警 `BACKLOG`

- **优先级**：mid
- **目标**：代付资金见底前有告警，而不是用户转账失败才发现
- **依赖**：无
- **验收命令**：`bash -n scripts/ops/<新脚本>.sh` + 一次干跑输出当前余额

---

## F3.4 — 发布物安全检查

### T3.4.1 浏览器 bundle 密钥泄漏扫描 `BACKLOG`

- **优先级**：mid
- **目标**：构建产物里不含任何私钥/密钥/内部 endpoint（DoD #8）
- **依赖**：无
- **验收命令**：`npm run build -w aastar-frontend && bash scripts/security/<扫描脚本>.sh`

---

## F3.5 — 已知安全缺口跟踪

### T3.5.1 executeRecovery TOCTOU 窗口（issue #447） `BLOCKED`

- **优先级**：mid
- **目标**：收敛「链上 proposal 校验 → 实际执行」之间的时间窗
- **阻塞原因**：issue
  #447 自己标注「已知、暂不可闭合」—— 需要合约侧配合（原子化校验+执行）
- **待决问题**：是等合约侧提供原子接口，还是在 YAA 侧接受窗口并加监控告警？
- **依赖**：外部（Validator 合约仓库）
- **关联**：issue #447、PR #441/#446/#449

---

## 未收编项（登记，不进 M/F）

- **`7702` 分支** — EIP-7702 独立实验，落后 master 168 commit，`7702/`
  目录不在 npm workspaces 里，与主线无耦合。**保留不动**（已写进 `.pilot.yml` 的
  `protect_patterns`），不作为 Task。
- **issue #378** — 「[评估] 通知绑定方案的 YAA UI 部分」，主体在
  `aastar-sdk#193`，等上游方案定了再决定是否拆 Task。
