import { calculateTokenImpact, type TokenImpact } from "./token-impact.js";

export interface ContextPolicyConfig {
  readonly killSwitch: boolean;
  readonly toolOutput: {
    readonly enabled: boolean;
    readonly collapseRepeatedLinesAfter: number;
    readonly maximumInputCharacters: number;
  };
  readonly exactRedundancy: { readonly enabled: boolean };
}

export interface PolicyDecision {
  readonly policy: "tool-output" | "exact-redundancy";
  readonly policyVersion: "v1";
  readonly applied: boolean;
  readonly reason: string;
  readonly affectedItems: number;
  readonly charactersRemoved: number;
}

export interface ContextPolicyResult {
  readonly value: unknown;
  readonly changed: boolean;
  readonly decisions: readonly PolicyDecision[];
}

export interface PolicyReplayResult extends ContextPolicyResult {
  readonly impact: TokenImpact;
}

export function applyContextPolicies(
  value: unknown,
  config: ContextPolicyConfig,
): ContextPolicyResult {
  if (config.killSwitch) {
    return {
      value,
      changed: false,
      decisions: [
        disabledDecision("tool-output", "global-kill-switch"),
        disabledDecision("exact-redundancy", "global-kill-switch"),
      ],
    };
  }
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    return {
      value,
      changed: false,
      decisions: [
        disabledDecision("tool-output", "messages-unavailable"),
        disabledDecision("exact-redundancy", "messages-unavailable"),
      ],
    };
  }
  const toolOutput = applyToolOutputPolicy(value.messages, config.toolOutput);
  const redundancy = applyExactRedundancyPolicy(
    toolOutput.messages,
    config.exactRedundancy.enabled,
  );
  const changed = toolOutput.changed || redundancy.changed;
  return {
    value: changed ? { ...value, messages: redundancy.messages } : value,
    changed,
    decisions: [toolOutput.decision, redundancy.decision],
  };
}

export function replayContextPolicies(
  value: unknown,
  config: ContextPolicyConfig,
): PolicyReplayResult {
  const result = applyContextPolicies(value, config);
  const baselineInputTokens = estimateJsonTokens(value);
  const forwardedInputTokens = estimateJsonTokens(result.value);
  return {
    ...result,
    impact: calculateTokenImpact({
      baselineInputTokens,
      forwardedInputTokens,
      provenance: "estimate",
    }),
  };
}

function applyToolOutputPolicy(
  messages: readonly unknown[],
  config: ContextPolicyConfig["toolOutput"],
): {
  readonly messages: readonly unknown[];
  readonly changed: boolean;
  readonly decision: PolicyDecision;
} {
  if (!config.enabled) {
    return { messages, changed: false, decision: disabledDecision("tool-output", "disabled") };
  }
  let affectedItems = 0;
  let charactersRemoved = 0;
  const transformed = messages.map((message) => {
    if (!isRecord(message) || message.role !== "tool" || typeof message.content !== "string") {
      return message;
    }
    const compacted = compactToolOutput(message.content, config);
    if (compacted === message.content) return message;
    affectedItems += 1;
    charactersRemoved += message.content.length - compacted.length;
    return { ...message, content: compacted };
  });
  return {
    messages: affectedItems === 0 ? messages : transformed,
    changed: affectedItems > 0,
    decision: {
      policy: "tool-output",
      policyVersion: "v1",
      applied: affectedItems > 0,
      reason: affectedItems > 0 ? "deterministic-compaction" : "no-eligible-output",
      affectedItems,
      charactersRemoved,
    },
  };
}

function applyExactRedundancyPolicy(
  messages: readonly unknown[],
  enabled: boolean,
): {
  readonly messages: readonly unknown[];
  readonly changed: boolean;
  readonly decision: PolicyDecision;
} {
  if (!enabled) {
    return { messages, changed: false, decision: disabledDecision("exact-redundancy", "disabled") };
  }
  const retained: unknown[] = [];
  let affectedItems = 0;
  let charactersRemoved = 0;
  for (const message of messages) {
    const previous = retained.at(-1);
    if (isDuplicateToolResult(previous, message)) {
      affectedItems += 1;
      charactersRemoved += JSON.stringify(message).length;
    } else {
      retained.push(message);
    }
  }
  return {
    messages: affectedItems === 0 ? messages : retained,
    changed: affectedItems > 0,
    decision: {
      policy: "exact-redundancy",
      policyVersion: "v1",
      applied: affectedItems > 0,
      reason: affectedItems > 0 ? "consecutive-identical-tool-result" : "no-exact-duplicate",
      affectedItems,
      charactersRemoved,
    },
  };
}

function compactToolOutput(
  content: string,
  config: ContextPolicyConfig["toolOutput"],
): string {
  if (content.length > config.maximumInputCharacters) return content;
  const cleaned = content
    .replace(/\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F]/g, "");
  const lines = cleaned.split("\n");
  const collapsed: string[] = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? "";
    let end = index + 1;
    while (end < lines.length && lines[end] === line) end += 1;
    const count = end - index;
    if (count >= config.collapseRepeatedLinesAfter) {
      collapsed.push(line, `[Token Shuffle: preceding line occurred ${count} times]`);
    } else {
      collapsed.push(...lines.slice(index, end));
    }
    index = end;
  }
  return collapsed.join("\n");
}

function isDuplicateToolResult(previous: unknown, current: unknown): boolean {
  if (!isRecord(previous) || !isRecord(current)) return false;
  if (previous.role !== "tool" || current.role !== "tool") return false;
  if (
    typeof previous.tool_call_id !== "string" ||
    previous.tool_call_id !== current.tool_call_id
  ) {
    return false;
  }
  return JSON.stringify(previous) === JSON.stringify(current);
}

function disabledDecision(
  policy: PolicyDecision["policy"],
  reason: string,
): PolicyDecision {
  return {
    policy,
    policyVersion: "v1",
    applied: false,
    reason,
    affectedItems: 0,
    charactersRemoved: 0,
  };
}

function estimateJsonTokens(value: unknown): number {
  return Math.max(
    1,
    Math.ceil(new TextEncoder().encode(JSON.stringify(value)).byteLength / 4),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
