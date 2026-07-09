# Production Readiness — YetAnotherAA

> 发布"正式版"的阻塞项 + 评估。最后更新：2026-07-09。口径：目前全站
> **Sepolia**（`CHAIN_ID=11155111`）。下表已并入 jason 的决策。

## 结论

**功能层面已接近可发**：核心用户流程都验过（见「已就绪」），历史上最大的阻塞——转账走 legacy
passkey 被 KMS 拒的 500——**已解**（转账改成 WebAuthn device-passkey
ceremony，Tier-2/3 = algId 0x09/0x0a，链上 tier3-composite LIVE
PASS）。后端 41 单测 + 前端 10 Playwright e2e 绿。

真正的"卡点"不是功能，而是两个**策略决策**（现已明确为非硬阻塞）+ 少量 YAAA 侧能自收的小项。外部依赖已通过狗头（多仓协同）分发，等各仓回复。

---

## A. 策略决策（已明确，非硬阻塞）

| #   | 项                       | 决策 / 评估                                                                                                                                                                                                                                                                   |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **网络：Sepolia → 主网** | **非阻塞 = 配置开关**。RPC 配置里已备主网，切换 = 改 `ETH_RPC_URL`/`BUNDLER_RPC_URL` 的网址（同一 RPC provider），SDK canonical 地址随链切。发主网时再切即可。USDC 目前是 **Sepolia 测试网 USDC**，用于买币流程（tok-01 gasless / tok-03 self-pay / tok-06 slippage）的测试。 |
| 2   | **部署拓扑**             | **先单机**。当前 = 单机 cloudflared 隧道（:5173/:3000）。未来把它也部署到 **imx93 主板**、继续用 cloudflared 隧道当前端出口。非阻塞，按此推进。关联 draft #400（纯前端迁移，能干掉后端依赖，当前 PAUSED）。                                                                   |

---

## B. YAAA 侧应做（自己能收）

| #   | 项                                                               | 评估                                                                                                                                                                                                                               | 状态                        |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 3   | **Paymaster `validatePaymasterSignature` stub**（`return true`） | 排查后确认是**死代码**（零调用者），不在任何关键/安全路径上。正确处理 = 删除。                                                                                                                                                     | ✅ **本轮已删**（此 PR）    |
| 4   | **治理写侧 E2E**（#427）                                         | 代码完整、build/type-check/lint 绿、`getMinDelay` 实链验过。schedule/execute 真跑需运营先把 timelock 交权到 `slashPolicyAdmin`（现为 deployer EOA）。                                                                              | ⏳ 待运营交权后 E2E         |
| 5   | **Security Audit CI 门红**                                       | 已知：axios high 漏洞经 `@ledgerhq` 传递依赖（via `@aastar/airaccount`），无 non-breaking fix，CI 里 `allow-ghsas: GHSA-43fc-jf86-j433` 白名单放行。正式版建议：出一份"已知漏洞 + 缓解"说明，盯 ledgerhq 升级 axios 后移除白名单。 | 🟠 记录在案（见下「安全」） |
| 6   | **生产配置验证**                                                 | 逐项过：`DB_TYPE=postgres` 真跑过一遍？KMS 板子（imx93，CC-22）provision？密钥/Secrets 管理？启动必填项（JWT_SECRET / USER_ENCRYPTION_KEY 32 字符 / ETH_RPC_URL / BUNDLER_RPC_URL）。                                              | 🟠 待逐项核对               |

---

## C. 外部依赖 / 可延后（已发狗头，等回复）

| #   | 项                                                        | 评估                                                                                                    | 状态                                      |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 7   | **CC-28 xPNTs 发行上限 + 滥发防护**                       | SP 侧经济可信度设计，影响 gasless 故事的可信度。非 YAAA 代码。                                          | 🐾 已发狗头，等 @repo:sp                  |
| 8   | **CC-13 DVT slash 真 E2E**                                | slash "有牙齿"机制未实链跑（等 dvt1/2/3 原子部署 + 造 over-limit operator）。不挡用户流程，挡安全叙事。 | 🐾 已发狗头，等 @repo:dvt                 |
| 9   | **建号画像 ②**（create-with-profile）                     | 前端画像卡 + 后端 prepare-create DTO（initialTokens/Configs）。增强项，非阻塞。                         | 🟢 延后                                   |
| 10  | **CC-27 airaccount 改名落地**（→ `AAStarBLSKeyRegistry`） | 决策已定（jason 拍板），等 airaccount 下个合约版本 bump 的 rename PR。不挡 YAAA。                       | 🐾 已发狗头，等 @repo:airaccount-contract |

---

## ✅ 已就绪（本轮核实）

- **注册** — WebAuthn passkey（e2e `register.spec.ts`）
- **建号** — create account（#346 修过时工厂地址）
- **转账 T1/T2/T3** — WebAuthn device-passkey ceremony（algId 0x09/0x0a），链上
  `tier3-composite.mjs` LIVE PASS；**旧 legacy-passkey
  500 已解**。e2e：`transfer.spec.ts` / `transfer-tier3.spec.ts` /
  `transfer-negatives.spec.ts` / `transfer-replay.spec.ts`
- **Gasless / Paymaster** — tok-01 gasless 验过（e2e + onchain script）
- **买币** — /tokens 页（#357），tok-01/03/06 覆盖
- **治理配置页** — 读侧（#425/#426，实链读 canonical
  `0xF51c…`），写侧（#427，代码完整）
- **测试** — 后端 41 单测；前端 10 Playwright
  e2e（transfer/tier3/register/operator/operator-onboarding/community/guard/public/…）

---

## 安全（#5 展开）

| 项                                | 现状                                                | 缓解                                                                                      |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| axios high（GHSA-43fc-jf86-j433） | 经 `@ledgerhq`（`@aastar/airaccount` 可选依赖）传入 | CI `dependency-review` 白名单放行；无 non-breaking fix；盯 ledgerhq 升 axios 后移除白名单 |
| Security Audit CI job             | 已知常红（非其他门）                                | 除此外所有门（build/test/type-check/code-quality）必须绿                                  |

---

## 「马上就能做」评估（10 项里）

- **能立刻做 + 小工作量**：#3（死代码删除，✅ 本轮做了）、#5（安全说明，✅ 本文档记录）。
- **决策已明确、发主网/上板时执行**：#1（改 RPC URL）、#2（部 imx93）。
- **需运营/基础设施动作**：#4（timelock 交权后 E2E）、#6（生产配置核对）。
- **外部仓、已发狗头等回复**：#7 / #8 / #10。
- **增强、可延后**：#9。

**净结论**：YAAA 侧能自己收的小项，本轮已收（#3 +
#5 文档化）。剩下的要么是"发布时的配置开关"（#1/#2），要么等运营/外部仓。
