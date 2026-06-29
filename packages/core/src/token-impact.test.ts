import { describe, expect, it } from "vitest";

import { calculateTokenImpact } from "./token-impact.js";

describe("calculateTokenImpact", () => {
  it("subtracts optimization work from literal input reduction", () => {
    expect(
      calculateTokenImpact({
        baselineInputTokens: 10_000,
        forwardedInputTokens: 7_000,
        optimizationInputTokens: 400,
        optimizationOutputTokens: 100,
        provenance: "provider-tokenizer",
      }),
    ).toMatchObject({
      literalInputTokensAvoided: 3_000,
      netTokensAvoided: 2_500,
    });
  });

  it("does not misreport prompt-cache reads as tokens avoided", () => {
    expect(
      calculateTokenImpact({
        baselineInputTokens: 10_000,
        cacheReadInputTokens: 8_000,
        forwardedInputTokens: 10_000,
        provenance: "provider-reported",
      }),
    ).toMatchObject({
      cacheReadInputTokens: 8_000,
      literalInputTokensAvoided: 0,
      netTokensAvoided: 0,
    });
  });

  it("allows optimization work to produce a negative net result", () => {
    expect(
      calculateTokenImpact({
        baselineInputTokens: 1_000,
        forwardedInputTokens: 900,
        optimizationOutputTokens: 150,
        provenance: "estimate",
      }).netTokensAvoided,
    ).toBe(-50);
  });

  it("rejects invalid token counts", () => {
    expect(() =>
      calculateTokenImpact({
        baselineInputTokens: -1,
        forwardedInputTokens: 0,
        provenance: "estimate",
      }),
    ).toThrow(RangeError);
  });
});
