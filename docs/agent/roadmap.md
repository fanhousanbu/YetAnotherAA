# YetAnotherAA Roadmap — Milestone → Feature

> - 「未来要做什么」。具体怎么做 + 验收见 [`tasks.md`](tasks.md)；此刻在做什么见
>   [`progress.md`](progress.md)。
> - 编号：`M<里程碑>` → `F<里程碑>.<序号>`
> - 记录日期：2026-08-02
>
> **来源**：本 roadmap 不是新造的，是把仓库既有规划转成三级结构：
>
> - 里程碑划分 =
>   [`../BETA_READINESS_ASSESSMENT.md`](../BETA_READINESS_ASSESSMENT.md)
>   §5 三阶段计划
> - Feature/Task 素材 = 同文档 §4 must-do +
>   [`../LAUNCH_READINESS_PLAN.md`](../LAUNCH_READINESS_PLAN.md) 五步 + open
>   issues (#447/#382/#378) + 在途分支盘点
> - 每条状态都对着 master 的**代码**核过，不是照抄 7 月的文档结论（详见 tasks.md 各 Task 的「证据」）

---

## M1 — Beta 上线（Sepolia，二号 imx93 到位后）

目标：把**已被链上证据支撑的核心路径**（passkey 注册 → 建号 → gasless Tier
1/2/3 转账 → 买入 aPNTs/GToken）作为 beta 范围发出去；范围外的能力显式标 experimental，不假装可用。

- **F1.1 Beta 阻塞项收口** — `BETA_READINESS_ASSESSMENT` §4
  must-do 清单里**尚未闭合**的那几条（多数已在 7 月后落地，见 tasks.md 核查结论）
- **F1.2 高优负向用例** — 重放拒绝、JWT
  401、余额不足、passkey 取消：每条断言「被正确拒绝」而非静默通过
- **F1.3 Beta 范围闸门** — recovery / operator
  / 多 EntryPoint 在 UI 上显式标 experimental 或禁用，避免用户踩未验证路径
- **F1.4 转账 UX 抢救项** — 从被废弃的 `feat/registry-portal-sdk`
  抢救出来的两个未落地改进（AA26 智能 gas 估算+自动重试、最近收款人下拉），在当前 master 上重写
- **F1.5 KMS 单点消除** — 二号 imx93 到位后的双板 HA（硬件依赖，非本仓库代码）

## M2 — OP 主网发布（beta 期约一个月后）

目标：beta 跑满一个月、负向矩阵补全、运营者链路闭环之后，发布主网版本；发布前做小额真实资金冒烟。

- **F2.1 运营者准入闭环** — `operator-onboarding.spec.ts` 卡在 Step5 的
  `deployAndRegisterPaymasterV4` revert；查因 → 补 Step5–7（Paymaster 部署 +
  EntryPoint 充值 + Complete）
- **F2.2 完整负向/异常矩阵** — `LAUNCH_READINESS_PLAN.md`
  步骤 5 的 D1–D5 全表（L1 链上 / L2 API / L3 Playwright）
- **F2.3 Guardian 协签 UX 闭环** — issue
  #382：提额(#3b) 已落地，转账 Tier-3 协签(#3a) 待补
- **F2.4 多 EntryPoint 覆盖** — 目前只验过 v0.7；v0.6 / v0.8 未测
- **F2.5 前端单测** — 至少覆盖 transfer / auth 关键路径（目前前端零测试）
- **F2.6 主网冒烟** — gasless 转账 +
  gasless 买入各一笔，小额，证据归档；**全部前项通过后才做**

## M3 — 基建加固（与 M1/M2 并行推进）

目标：把 beta/主网依赖的基础设施从「单点 + 手工」变成「冗余 + 可观测」，并解锁被基建卡住的纯前端迁移。

- **F3.1 API-key 模型 / KMS Origin**
  — 浏览器直连 bundler+KMS 的授权模型；这是 F3.2 的硬前置
- **F3.2 纯前端零后端迁移** — PR
  #400（draft，自标 WIP·PAUSED）解冻；含 localStorage 存储类的数据迁移决策
- **F3.3 依赖存量监控** — bundler / paymaster / EntryPoint
  deposit 余额告警，DVT 节点存活
- **F3.4 发布物安全检查** — 浏览器 bundle 密钥泄漏扫描（DoD #8）
- **F3.5 已知安全缺口跟踪** — issue #447（executeRecovery
  TOCTOU 窗口，已知、当前不可闭合）的收敛条件与再评估

## M4 — cos72 多社区演进（只到 Feature 层，暂不拆 Task）

目标：从「单站点 YAA」演进到「小社区可自助拥有的协作站点」。
**方向仍在收敛，故本里程碑刻意不拆 Task** —— 避免 `pilot run`
在产品方向未定时抢跑。真要开工前需先补 `research.md` + `acceptance.md`。

- **F4.1 配置即部署** — 一份配置驱动一个社区站点的产出（skill 化）
- **F4.2 多租户子域插件** — no-code 小社区 + 可评估的 Chrome 插件形态
- **F4.3 create-app 模版** — 已有 `create-cos72-dapp` /
  Cos72 雏形，需收敛成正式模版
- **F4.4 可嵌入 SDK** — JS 引用 + React 组件两种嵌入形态
- **F4.5 移动端与 FangPay** — 终点形态，依赖 F4.1–F4.4

> 注：M4 的多数实现落在独立仓库（`cos72-tour` /
> `create-cos72-dapp`）。本 roadmap 只记录 YAA 侧需要暴露的能力与边界。

---

> **当前聚焦**：M1 / F1.2 + F1.4。M4 只到 Feature 层，`pilot run`
> 不应从 M4 挑 Task。每个 Feature 的 Task 拆分与状态见 [`tasks.md`](tasks.md)。
