import { sepolia, optimism } from "viem/chains";
import { resolveChain } from "./chain.util";

describe("resolveChain", () => {
  it("returns the canonical viem chain object for a known id", () => {
    expect(resolveChain(11155111)).toBe(sepolia);
    expect(resolveChain(10)).toBe(optimism);
  });

  it("synthesizes a minimal chain for an unknown id rather than throwing", () => {
    const chain = resolveChain(31337);
    expect(chain.id).toBe(31337);
    expect(chain.nativeCurrency.decimals).toBe(18);
  });

  it("rejects ids that could silently target the wrong chain", () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      expect(() => resolveChain(bad)).toThrow(/Invalid chainId/);
    }
  });
});
