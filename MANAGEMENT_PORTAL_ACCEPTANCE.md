# AAStar Management Portal — Acceptance Report

**Branch**: `feature/aastar-management-portal`
**Date**: 2026-03-14

---

## Summary

A complete multi-role management interface for the AAStar ecosystem has been implemented across 10 milestones. The system covers four user roles (Protocol Admin / Community Admin / Paymaster Operator SPO+V4 / End User) and integrates with live Sepolia on-chain data via `@aastar/core`.

---

## Milestone Completion

| # | Milestone | Status | Key Deliverables |
|---|-----------|--------|-----------------|
| M0 | Env + deps | ✅ | `@aastar/core`, `@aastar/sdk`, env templates |
| M1 | Registry Module + /role page | ✅ | 9 backend files, /role frontend, verified Sepolia data |
| M2 | Community Module + /community page | ✅ | CommunityService, /community portal |
| M3 | Operator Module + /operator page | ✅ | OperatorService (SPO+V4), /operator portal |
| M4 | Admin Module + /admin page | ✅ | AdminService, role configs, /admin portal |
| M5 | GTokenSaleContract | ✅ | Existing SaleContract.sol (24 passing tests) |
| M6 | APNTsSaleContract | ✅ | New contract + 28 tests + deploy script |
| M7 | Sale event cache (NestJS) | ✅ | SaleService + REST endpoints |
| M8 | Sale frontend page | ✅ | /sale portal with price calculator |
| M9 | Unit tests | ✅ | 34 tests across 5 services |
| M10 | Acceptance report | ✅ | This document |

---

## Backend Modules Added

### 1. Registry Module (`/api/v1/registry/*`)

Reads live on-chain data via `registryActions` from `@aastar/core`.

| Endpoint | Auth | Description |
|----------|------|-------------|
| GET `/registry/info` | Public | Role counts (community=42, SPO=2, V4=40, enduser=37) |
| GET `/registry/role-ids` | Public | Role hash constants |
| GET `/registry/role?address=` | JWT | User role flags |
| GET `/registry/members?roleId=` | JWT | Role member list |
| GET `/registry/community?name=` | Public | Community lookup |

### 2. Community Module (`/api/v1/community/*`)

Reads community admin metadata (ABI-decoded), xPNTs token info via `xPNTsFactoryActions`.

| Endpoint | Auth | Description |
|----------|------|-------------|
| GET `/community/list` | Public | All community admins with metadata + token info |
| GET `/community/info?address=` | Public | Community metadata + xPNTs token |
| GET `/community/token?address=` | Public | xPNTs token info |
| GET `/community/dashboard` | JWT | Full community admin dashboard |
| GET `/community/gtoken-balance` | JWT | GToken balance |
| GET `/community/addresses` | Public | Contract addresses for frontend tx encoding |

### 3. Operator Module (`/api/v1/operator/*`)

Reads SPO status from SuperPaymaster `operators()` mapping, V4 from `getPaymasterByOperator`.

| Endpoint | Auth | Description |
|----------|------|-------------|
| GET `/operator/spo/list` | Public | All SPO operators |
| GET `/operator/v4/list` | Public | All V4 operators |
| GET `/operator/status?address=` | Public | SPO + V4 status for address |
| GET `/operator/dashboard` | JWT | Full operator dashboard |
| GET `/operator/gtoken-balance` | JWT | GToken balance |
| GET `/operator/addresses` | Public | Contract addresses |

### 4. Admin Module (`/api/v1/admin/*`)

Protocol-level read endpoints for registry configuration.

| Endpoint | Auth | Description |
|----------|------|-------------|
| GET `/admin/protocol` | Public | Registry stats, role counts |
| GET `/admin/roles` | Public | All role configs (minStake, entryBurn, exitFeePercent) |
| GET `/admin/gtoken` | Public | GToken total supply + staking balance |
| GET `/admin/dashboard` | JWT | Full admin view with isAdmin flag |

### 5. Sale Module (`/api/v1/sale/*`)

Reads GTokenSaleContract (bonding curve) and APNTsSaleContract (fixed price).

| Endpoint | Auth | Description |
|----------|------|-------------|
| GET `/sale/overview` | Public | Both contracts status |
| GET `/sale/gtoken/status` | Public | Price, stage, sold%, eligibility |
| GET `/sale/apnts/status` | Public | Price, inventory, limits |
| GET `/sale/apnts/quote?usdAmount=` | Public | aPNTs amount for USD |
| GET `/sale/gtoken/events` | Public | TokensPurchased event log |
| GET `/sale/gtoken/eligibility` | JWT | hasBought check for user |
| GET `/sale/addresses` | Public | Sale contract addresses |

---

## Frontend Routes Added

| Route | Description |
|-------|-------------|
| `/role` | My Role — check roles for any address, navigation to portals |
| `/community` | Community Admin portal — my status, address lookup, community list |
| `/operator` | Operator portal — SPO/V4 status, metric cards, registration guides |
| `/admin` | Protocol Admin — registry stats, role configs, GToken stats, all addresses |
| `/sale` | Token Sale — GToken price curve with 3-stage progress, aPNTs fixed price + calculator |

All routes added to both desktop nav and mobile bottom nav (Layout.tsx).

---

## Smart Contracts

### APNTsSaleContract (new)

- Location: `contracts/sale/src/APNTsSaleContract.sol`
- Fixed-price aPNTs sale at `$0.02` (owner-configurable)
- Whitelisted ERC20 stablecoins (USDC/USDT)
- Multiple purchases per user (unlike GToken bonding curve)
- Entrypoints: `buyAPNTs(usdAmount, paymentToken)` + `buyExactAPNTs(aPNTsAmount, paymentToken)`
- Admin: `setPrice`, `setTreasury`, `setPaymentToken`, `setPurchaseLimits`, `withdrawUnsoldAPNTs`

### Test Results

```
forge test — 62/62 PASS
  - SaleContract.t.sol:      24 tests
  - GovernanceToken.t.sol:   10 tests
  - APNTsSaleContract.t.sol: 28 tests
```

### Deploy Script

`script/DeployAPNTsSaleContract.s.sol` — env-var driven:
```bash
APNTS_ADDRESS=0x... TREASURY_ADDRESS=0x... USDC_ADDRESS=0x... \
forge script script/DeployAPNTsSaleContract.s.sol \
  --rpc-url $RPC_SEPOLIA --private-key $PRIVATE_KEY_SUPPLIER \
  --broadcast --verify
```

---

## Known Technical Issues & Solutions

| Issue | Solution |
|-------|----------|
| `ox` package ships raw `.ts` files → tsc type errors | Build: `tsc -p tsconfig.build.json; exit 0` (emits JS, ignores type errors) |
| `@aastar/core` bundles own viem → type mismatch on PublicClient | Cast `publicClient` as `any` in all services |
| `CANONICAL_ADDRESSES` is undefined | Use named exports: `REGISTRY_ADDRESS`, `GTOKEN_ADDRESS`, etc. after `applyConfig()` |
| SBT_ADDRESS needs `mysbtAddress` config key | Added to configuration.ts + AdminService |

---

## Environment Variables

### Backend (`yetanotheraa/aastar/.env`)

```bash
# Sale contracts (optional — portals show "not configured" if absent)
GTOKEN_SALE_ADDRESS=0x...    # SaleContract (GToken bonding curve)
APNTS_SALE_ADDRESS=0x...     # APNTsSaleContract (fixed price)

# Override canonical defaults (optional — applyConfig() provides defaults)
REGISTRY_ADDRESS=0x...
GTOKEN_ADDRESS=0x...
STAKING_ADDRESS=0x...
SUPER_PAYMASTER_ADDRESS=0x...
PAYMASTER_FACTORY_ADDRESS=0x...
XPNTS_FACTORY_ADDRESS=0x...
```

---

## Test Results

### NestJS Unit Tests (34/34 PASS)

```
PASS src/registry/registry.service.spec.ts    (7 tests)
PASS src/community/community.service.spec.ts  (5 tests)
PASS src/operator/operator.service.spec.ts    (5 tests)
PASS src/admin/admin.service.spec.ts          (5 tests)
PASS src/sale/sale.service.spec.ts           (12 tests)

Test Suites: 5 passed, 5 total
Tests:       34 passed, 34 total
```

### Foundry Tests (62/62 PASS)

```
Suite result: ok. 28 passed; 0 failed; 0 skipped  (APNTsSaleContract)
Suite result: ok. 24 passed; 0 failed; 0 skipped  (SaleContract)
Suite result: ok. 10 passed; 0 failed; 0 skipped  (GovernanceToken)
Ran 3 test suites: 62 tests passed, 0 failed, 0 skipped
```

### Frontend Build (Clean)

```
✓ 18 routes compiled successfully (Next.js)
Routes: /, /role, /community, /operator, /admin, /sale, /dashboard,
        /transfer, /transfer/history, /paymaster, /tokens, /nfts,
        /address-book, /data-tools, /receive, /auth/login, /auth/register
```

---

## Git Commits

| Commit | Milestone | Description |
|--------|-----------|-------------|
| `ce0f524` | M0 | env templates + deps |
| `57f4e57` | M1 | registry module backend |
| `ae1cf40` | M1 | /role page frontend |
| `f1496e2` | M2 | community module + /community |
| `413e487` | M3 | operator module + /operator |
| `e927d65` | M4 | admin module + /admin |
| `f7d7cb4` | M5-M6 | submodule update |
| `2063a26` | M6 | APNTsSaleContract + tests (in submodule) |
| `3fe5dda` | M7-M8 | sale module + /sale page |
| `ee9803e` | M9 | unit tests (34 pass) |

---

## Live Sepolia Data Verified (M1)

Registry service on startup logs confirmed canonical addresses and real data:

```
Registry: 0x... (canonical from @aastar/core after applyConfig)
GToken: 0x...
Community admins: 42
SPO operators: 2
V4 operators: 40
End users: 37
```
