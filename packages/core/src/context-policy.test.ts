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
  conversationCompaction: {
    enabled: false,
    minimumMessages: 12,
    activeWindowMessages: 6,
    maximumSourceCharacters: 256_000,
  },
};
const fingerprintSource = (source: string): string => {
  const checksum = [...source].reduce(
    (total, character) => (total + character.charCodeAt(0)) >>> 0,
    0,
  );
  return `hmac-sha256-${checksum.toString(16).padStart(64, "0")}`;
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
      fingerprintSource,
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

  it("compacts old turns into structured state while retaining constraints and an active window", () => {
    const messages = [
      { role: "system", content: "You are a coding assistant." },
      { role: "user", content: "Build the release. You must preserve API compatibility." },
      { role: "assistant", content: "I decided to use TypeScript." },
      { role: "user", content: "Update src/app.ts and docs/README.md." },
      { role: "assistant", content: "The first test failed with Error: expected 2." },
      { role: "user", content: "Do not delete the compatibility fixture." },
      { role: "assistant", content: "I updated src/app.ts." },
      { role: "user", content: "What remains open?" },
      { role: "assistant", content: "The browser test remains." },
      { role: "user", content: "Run it now." },
      { role: "assistant", content: "Running the browser test." },
      { role: "user", content: "Keep this active turn verbatim." },
      { role: "assistant", content: "This active response is verbatim." },
    ].map((message, index) =>
      index > 0 && index < 9
        ? { ...message, content: `${message.content}\n${"background ".repeat(80)}` }
        : message,
    );
    const result = replayContextPolicies(
      { model: "synthetic", messages },
      {
        ...active,
        toolOutput: { ...active.toolOutput, enabled: false },
        exactRedundancy: { enabled: false },
        conversationCompaction: {
          enabled: true,
          minimumMessages: 10,
          activeWindowMessages: 4,
          maximumSourceCharacters: 100_000,
        },
      },
      fingerprintSource,
    );
    const forwarded = (result.value as { messages: Array<{ role: string; content: string }> })
      .messages;
    const summary = forwarded.find((message) =>
      message.content.startsWith("Token Shuffle deterministic compacted state."),
    );

    expect(result.changed).toBe(true);
    expect(summary?.content).toContain("must preserve API compatibility");
    expect(summary?.content).toContain("Do not delete the compatibility fixture");
    expect(summary?.content).toContain("src/app.ts");
    expect(summary?.content).toContain("Error: expected 2");
    expect(summary?.content).toContain("What remains open?");
    expect(forwarded.slice(-4)).toEqual(messages.slice(-4));
    expect(forwarded[0]).toEqual(messages[0]);
    expect(result.impact.netTokensAvoided).toBeGreaterThan(0);
    expect(result.decisions[2]).toMatchObject({
      applied: true,
      policy: "conversation-compaction",
      sourceStart: 1,
      sourceEnd: 8,
      summaryVersion: "deterministic-v1",
    });
  });

  it("changes the invalidation fingerprint when compacted source changes", () => {
    const config: ContextPolicyConfig = {
      ...active,
      toolOutput: { ...active.toolOutput, enabled: false },
      exactRedundancy: { enabled: false },
      conversationCompaction: {
        enabled: true,
        minimumMessages: 4,
        activeWindowMessages: 2,
        maximumSourceCharacters: 100_000,
      },
    };
    const original = {
      messages: [
        { role: "user", content: `Must keep tests.\n${"background ".repeat(100)}` },
        { role: "assistant", content: `Use TypeScript.\n${"background ".repeat(100)}` },
        { role: "user", content: "active" },
        { role: "assistant", content: "active response" },
      ],
    };
    const changed = {
      messages: [
        { role: "user", content: `Must keep tests and docs.\n${"background ".repeat(100)}` },
        ...original.messages.slice(1),
      ],
    };
    const first = applyContextPolicies(original, config, fingerprintSource).decisions[2];
    const second = applyContextPolicies(changed, config, fingerprintSource).decisions[2];

    expect(first?.sourceFingerprint).toMatch(/^hmac-sha256-/);
    expect(second?.sourceFingerprint).not.toBe(first?.sourceFingerprint);
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

  it("fails open when compaction has no scoped fingerprint function", () => {
    const input = {
      messages: [
        { role: "user", content: `Must keep tests.\n${"background ".repeat(100)}` },
        { role: "assistant", content: `Use TypeScript.\n${"background ".repeat(100)}` },
        { role: "user", content: "active" },
        { role: "assistant", content: "active response" },
      ],
    };
    const result = applyContextPolicies(input, {
      ...active,
      conversationCompaction: {
        enabled: true,
        minimumMessages: 4,
        activeWindowMessages: 2,
        maximumSourceCharacters: 100_000,
      },
    });

    expect(result.value).toBe(input);
    expect(result.decisions[2]?.reason).toBe("fingerprint-unavailable");
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
