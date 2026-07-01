import { describe, expect, it } from "vitest";

import {
  applyContextPolicies,
  replayContextPolicies,
  type ContextPolicyConfig,
} from "./context-policy.js";

const active: ContextPolicyConfig = {
  killSwitch: false,
  toolOutput: {
    enabled: true,
    collapseRepeatedLinesAfter: 3,
    maximumInputCharacters: 10_000,
  },
  exactRedundancy: { enabled: true },
};

describe("context policies", () => {
  it("compacts deterministic tool noise and removes only consecutive identical tool results", () => {
    const duplicate = {
      role: "tool",
      tool_call_id: "call-1",
      content: "\u001b[31mfail\u001b[0m\nsame\nsame\nsame\n",
    };
    const result = replayContextPolicies(
      {
        model: "synthetic",
        messages: [
          { role: "user", content: "run tests" },
          duplicate,
          duplicate,
          { role: "assistant", content: "reviewing" },
          duplicate,
        ],
      },
      active,
    );

    expect(result.changed).toBe(true);
    expect(result.value).toMatchObject({
      messages: [
        { role: "user", content: "run tests" },
        {
          role: "tool",
          content: "fail\nsame\n[Token Shuffle: preceding line occurred 3 times]\n",
        },
        { role: "assistant", content: "reviewing" },
        {
          role: "tool",
          content: "fail\nsame\n[Token Shuffle: preceding line occurred 3 times]\n",
        },
      ],
    });
    expect(result.impact.literalInputTokensAvoided).toBeGreaterThan(0);
    expect(result.impact.netTokensAvoided).toBe(result.impact.literalInputTokensAvoided);
  });

  it("is an identity function when killed or when no content is eligible", () => {
    const input = { model: "synthetic", messages: [{ role: "user", content: "hello" }] };
    const killed = applyContextPolicies(input, { ...active, killSwitch: true });
    const unchanged = applyContextPolicies(input, active);

    expect(killed.value).toBe(input);
    expect(killed.changed).toBe(false);
    expect(
      killed.decisions.every((decision) => decision.reason === "global-kill-switch"),
    ).toBe(true);
    expect(unchanged.value).toBe(input);
    expect(unchanged.changed).toBe(false);
  });

  it("fails open to the original output when the policy input limit is exceeded", () => {
    const original = `START${"x".repeat(100)}END`;
    const result = applyContextPolicies(
      {
        messages: [
          { role: "tool", tool_call_id: "call-1", content: original },
        ],
      },
      {
        ...active,
        toolOutput: { ...active.toolOutput, maximumInputCharacters: 64 },
        exactRedundancy: { enabled: false },
      },
    );
    const content = (result.value as { messages: Array<{ content: string }> }).messages[0]
      ?.content;
    expect(content).toBe(original);
    expect(result.changed).toBe(false);
  });
});
