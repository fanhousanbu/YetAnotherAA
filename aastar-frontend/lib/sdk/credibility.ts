/**
 * xPNTs economic-credibility disclosure — SDK boundary (CC-33).
 *
 * A community's xPNTs token exposes an on-chain, auto-computed credibility
 * snapshot (CC-28, SP-side): a 0–100 backing-coverage score plus the raw USD
 * accounting figures behind it. This module is a thin, read-only wrapper over the
 * @aastar/sdk 0.43.0 (`@aastar/sdk/core`) typed views — no signing, no writes —
 * so the disclosure page (`app/community/credibility`) only wires UI.
 *
 * - `xPNTsFactoryActions(factory)(client).getAllTokens()` enumerates the deployed
 *   community tokens (factory address from the SDK canonical table, never hardcoded).
 * - `xPNTsTokenActions()(client).getCredibility({ token })` reads all five views
 *   pinned to a single block, so the snapshot is self-consistent.
 *
 * The three `*ValueUSD` fields are **18-decimal fixed-point USD** (USD × 1e18),
 * NOT wei — verified on-chain (SDK CC-33): `formatUnits(v, 18)` for display,
 * raw `bigint` compares for the over-issue verdict (no float).
 *
 * @module lib/sdk/credibility
 */
import { erc20Abi } from "viem";
import type { Address, PublicClient } from "viem";
import {
  CHAIN_SEPOLIA,
  getCanonicalAddresses,
  xPNTsFactoryActions,
  xPNTsTokenActions,
  type Credibility,
} from "@aastar/sdk/core";
import { ensureSdkConfig, getPublicClient } from "./client";

export type { Credibility };

/** A community xPNTs token plus its display metadata and credibility snapshot. */
export interface CommunityCredibility {
  /** The xPNTs token contract address. */
  token: Address;
  /** ERC-20 name (falls back to the short address if the read reverts). */
  name: string;
  /** ERC-20 symbol (falls back to "xPNTs" if the read reverts). */
  symbol: string;
  /** Self-consistent on-chain credibility snapshot (5 views pinned to one block). */
  credibility: Credibility;
}

/** Canonical xPNTs factory for the configured chain (from the SDK, not hardcoded). */
export function getXPNTsFactory(chainId: number = CHAIN_SEPOLIA): Address {
  ensureSdkConfig(chainId);
  const factory = getCanonicalAddresses(chainId)?.xPNTsFactory;
  if (!factory) {
    throw new Error(`No canonical xPNTs factory for chain ${chainId}`);
  }
  return factory as Address;
}

/** Enumerate every community xPNTs token deployed by the canonical factory. */
export async function listCommunityTokens(
  client?: PublicClient,
  chainId: number = CHAIN_SEPOLIA
): Promise<Address[]> {
  ensureSdkConfig(chainId);
  const pc = client ?? getPublicClient();
  return xPNTsFactoryActions(getXPNTsFactory(chainId))(pc).getAllTokens();
}

/**
 * One-shot credibility snapshot for a token — the five credibility views batched
 * at a single block so `credibilityScore` can't drift out of sync with the USD
 * figures. Optionally pin a specific block for deterministic/historical reads.
 */
export async function getCredibility(
  token: Address,
  client?: PublicClient,
  chainId: number = CHAIN_SEPOLIA,
  blockNumber?: bigint
): Promise<Credibility> {
  ensureSdkConfig(chainId);
  const pc = client ?? getPublicClient();
  return xPNTsTokenActions()(pc).getCredibility(
    blockNumber === undefined ? { token } : { token, blockNumber }
  );
}

/** Short 0x…abcd form for display fallbacks. */
function shortAddr(addr: Address): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Read ERC-20 name/symbol for a token, tolerating non-standard tokens. */
export async function getTokenMeta(
  token: Address,
  client?: PublicClient
): Promise<{ name: string; symbol: string }> {
  const pc = client ?? getPublicClient();
  const [name, symbol] = await Promise.all([
    pc.readContract({ address: token, abi: erc20Abi, functionName: "name" }).catch(() => shortAddr(token)),
    pc.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => "xPNTs"),
  ]);
  return { name, symbol };
}

/**
 * Full disclosure feed: every community token with its metadata + credibility.
 * A single failed token is surfaced as `null` so one bad token can't blank the
 * whole page; callers filter it out.
 */
export async function listCommunityCredibility(
  chainId: number = CHAIN_SEPOLIA
): Promise<Array<CommunityCredibility | null>> {
  ensureSdkConfig(chainId);
  const pc = getPublicClient();
  const tokens = await listCommunityTokens(pc, chainId);
  return Promise.all(
    tokens.map(async (token): Promise<CommunityCredibility | null> => {
      try {
        const [meta, credibility] = await Promise.all([
          getTokenMeta(token, pc),
          getCredibility(token, pc, chainId),
        ]);
        return { token, name: meta.name, symbol: meta.symbol, credibility };
      } catch {
        return null;
      }
    })
  );
}
