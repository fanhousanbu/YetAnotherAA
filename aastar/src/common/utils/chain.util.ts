import { defineChain, type Chain } from "viem";
import {
  mainnet,
  sepolia,
  optimism,
  optimismSepolia,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia,
} from "viem/chains";

/**
 * The chains this backend is realistically configured against. Keeping an explicit
 * list (rather than scanning all of `viem/chains`) makes resolution deterministic —
 * several viem chain objects share an id, so a scan can silently pick the wrong one.
 */
const KNOWN_CHAINS: readonly Chain[] = [
  mainnet,
  sepolia,
  optimism,
  optimismSepolia,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia,
];

/**
 * Resolves a configured `chainId` to the viem `Chain` object used when broadcasting.
 *
 * Why this exists: viem requires an explicit `chain` on every write, and hardcoding
 * one (e.g. `sepolia`) lets the broadcast target drift away from the chainId that
 * domain-separates a signature — the signature then verifies against a chain the
 * transaction never touches. Both sides must read the same config value, so both
 * go through here. See PR #434 review.
 *
 * Passing the resolved chain to viem also buys a runtime guarantee: `writeContract`
 * asserts the RPC endpoint's own chain id matches `chain.id` before signing, so a
 * CHAIN_ID/ETH_RPC_URL mismatch fails loudly instead of producing an unusable signature.
 *
 * Unknown ids get a minimal descriptor — viem only needs `id` for the assertion and
 * for stamping the transaction; gas/fee details come from the RPC.
 */
export function resolveChain(chainId: number): Chain {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(
      `Invalid chainId "${chainId}" — expected a positive integer. Set CHAIN_ID in the environment.`
    );
  }

  const known = KNOWN_CHAINS.find(chain => chain.id === chainId);
  if (known) return known;

  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    // Unused: every client in this codebase supplies its own `transport`. Present
    // only because viem's Chain type requires it.
    rpcUrls: { default: { http: [] } },
  });
}
