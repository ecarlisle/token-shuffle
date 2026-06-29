export type CountProvenance =
  | "provider-reported"
  | "provider-tokenizer"
  | "compatible-tokenizer"
  | "estimate";

export interface TokenImpactInput {
  baselineInputTokens: number;
  forwardedInputTokens: number;
  optimizationInputTokens?: number;
  optimizationOutputTokens?: number;
  cacheReadInputTokens?: number;
  provenance: CountProvenance;
}

export interface TokenImpact {
  baselineInputTokens: number;
  forwardedInputTokens: number;
  literalInputTokensAvoided: number;
  netTokensAvoided: number;
  cacheReadInputTokens: number;
  provenance: CountProvenance;
}

function assertTokenCount(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

export function calculateTokenImpact(input: TokenImpactInput): TokenImpact {
  const optimizationInputTokens = input.optimizationInputTokens ?? 0;
  const optimizationOutputTokens = input.optimizationOutputTokens ?? 0;
  const cacheReadInputTokens = input.cacheReadInputTokens ?? 0;

  for (const [name, value] of Object.entries({
    baselineInputTokens: input.baselineInputTokens,
    cacheReadInputTokens,
    forwardedInputTokens: input.forwardedInputTokens,
    optimizationInputTokens,
    optimizationOutputTokens,
  })) {
    assertTokenCount(name, value);
  }

  const literalInputTokensAvoided = Math.max(
    0,
    input.baselineInputTokens - input.forwardedInputTokens,
  );
  const netTokensAvoided =
    literalInputTokensAvoided -
    optimizationInputTokens -
    optimizationOutputTokens;

  return {
    baselineInputTokens: input.baselineInputTokens,
    cacheReadInputTokens,
    forwardedInputTokens: input.forwardedInputTokens,
    literalInputTokensAvoided,
    netTokensAvoided,
    provenance: input.provenance,
  };
}
