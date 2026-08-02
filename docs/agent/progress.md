# YetAnotherAA 实时状态 — progress

> 「此刻仓库真实发生了什么」。由 `pilot run` 每一步更新。更新时间：2026-08-02
> 00:55

## 当前聚焦

- **Milestone**：M1 Beta 上线（Sepolia）
- **Feature**：F1.2 高优负向用例 / F1.4 转账 UX 抢救项
- **正在开发的 Task**：无（刚完成 `pilot plan`，等 `pilot run` 挑第一个 READY）
- **分支 / worktree**：`docs/pilot-plan`（无额外 worktree）
- **PR**：[#450](https://github.com/AAStarCommunity/YetAnotherAA/pull/450)（本规划台账自身，base
  `preview`）

## 仓库基线（2026-08-02）

- 集成分支 = `preview`（2026-08-02 从 master 建出并推到 origin）。 **PR 合进
  `preview`，`preview` → `master` 保留为人工决定** —— 不这样的话，无人值守的
  `pilot run` 见 daemon APPROVED 就会自动 squash 合进主干（PR #450 评审 High
  #1）
- 本地分支：`master` / `preview`（集成） / `docs/pilot-plan`（本 PR） /
  `refactor/pure-frontend`（PR #400 draft，base 仍是 master，解冻时需一并改到
  `preview`） / `7702`（实验，保护不清理）
- pre-commit hook ✅ 生效于 `.git/hooks`
- PR 评审 daemon ✅ 在线

## 进行中 / 待回执的 PR

| Task   | PR                                                               | 状态    | 备注                                                           |
| :----- | :--------------------------------------------------------------- | :------ | :------------------------------------------------------------- |
| T3.2.1 | [#400](https://github.com/AAStarCommunity/YetAnotherAA/pull/400) | BLOCKED | draft，自标 WIP·PAUSED，卡在 API-key/KMS-Origin 基建（T3.1.1） |

## 阻塞项（BLOCKED）

- **T1.1.6 KMS 双板 HA**：硬件依赖，等二号 imx93 到货。**待决**：YAA 侧配双 KMS
  endpoint 故障转移，还是由上游 KMS 做 VIP？
- **T1.2.4 Guard 真机复现**：需要真机 Face ID/Touch
  ID，CDP 虚拟认证器覆盖不到。**待决**：是否接受 CDP 降级验证？
- **T2.6.1 主网冒烟**：真实资金 + 发布闸门，必须最后做。**待决**：主网测试账户与预算上限由谁定？
- **T3.1.1
  API-key 授权模型**：当前写不出可机器验证的验收命令 → 保持 BACKLOG，不许直接转 READY
- **T3.2.1 纯前端迁移**：依赖 T3.1.1。**待决**：beta 要不要一次性导入既有后端数据到 localStorage，还是从零开始？
- **T3.5.1 executeRecovery
  TOCTOU（#447）**：需合约侧原子接口配合。**待决**：等合约，还是 YAA 侧接受窗口 + 加监控？

## 最近完成

- 2026-08-01 PR [#449](https://github.com/AAStarCommunity/YetAnotherAA/pull/449)
  合并进 master（`1d77b19`，squash）——
  guardian 恢复后的 DB 写入按爆炸半径排序（#446）
- 2026-08-02 `pilot plan` 建立三级规划：`roadmap.md` / `tasks.md` /
  `progress.md` + `.pilot.yml`
- 2026-08-02
  **陈旧分支清理**（用户拍板：抢救特性、废弃分支）。删除前均已打归档 tag，**且已推到 origin**
  ——任意 clone `git fetch --tags` 后即可 `git show <commit>`
  取回，不依赖某一台机器的本地仓库。验证：`git ls-remote --tags origin | grep archive`
  应返回 4 条。

  | 已删分支                       | 归档 tag                      | 处置                                |
  | :----------------------------- | :---------------------------- | :---------------------------------- |
  | `feat/registry-portal-sdk`     | `archive/registry-portal-sdk` | 特性抢救为 T1.4.1 / T1.4.2          |
  | `fix/portal-review-269`        | `archive/portal-review-269`   | 同上（门户主体已由 #269 进 master） |
  | `feat/tier3b-raise-limit`      | `archive/tier3b-raise-limit`  | 已被 PR #390 取代，无需抢救         |
  | `test/stage-1b-l1-more`        | `archive/stage-1b-l1-more`    | 同类用例已由 #415 落地              |
  | `fix/446-recovery-write-order` | —（内容已全进 master）        | 直接删除                            |

## 下一个 READY

按优先级排序，`pilot run` 应从这里挑：

1. **T1.2.1** 解冻并跑通 transfer-replay e2e（high）—— 依赖的 create-flow
   bug 已闭合，spec 的 `test.fixme` 与 BLOCKED 注释都已过期；验收须断言
   `1 passed`
2. **T1.2.2** JWT 401 鉴权负向用例（high）
3. **T1.3.1** 未验证能力 UI 标 experimental（high）
4. **T1.1.5** 把已闭合的 beta 阻塞项回写进评估文档（mid）
5. **T1.4.1** AA26 智能 gas 估算 + 自动重试（mid，**涉钱**：必须设 gas 硬上限）
6. **T1.4.2** 最近收款人下拉（low）
