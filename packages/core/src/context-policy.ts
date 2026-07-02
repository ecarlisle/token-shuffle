import { calculateTokenImpact, type TokenImpact } from "./token-impact.js";

export interface ContextPolicyConfig {
  readonly killSwitch: boolean;
  readonly toolOutput: {
    readonly enabled: boolean;
    readonly collapseRepeatedLinesAfter: number;
    readonly maximumInputCharacters: number;
  };
  readonly exactRedundancy: { readonly enabled: boolean };
  readonly conversationCompaction: {
    readonly enabled: boolean;
    readonly minimumMessages: number;
    readonly activeWindowMessages: number;
    readonly maximumSourceCharacters: number;
  };
}

export interface PolicyDecision {
  readonly policy:
    | "tool-output"
    | "exact-redundancy"
    | "conversation-compaction";
  readonly policyVersion: "v1";
  readonly applied: boolean;
  readonly reason: string;
  readonly affectedItems: number;
  readonly charactersRemoved: number;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
  readonly sourceFingerprint?: string;
  readonly summaryVersion?: string;
  readonly retainedMessages?: number;
}

export interface ContextPolicyResult {
  readonly value: unknown;
  readonly changed: boolean;
  readonly decisions: readonly PolicyDecision[];
}

export interface PolicyReplayResult extends ContextPolicyResult {
  readonly impact: TokenImpact;
}

export type ContentFingerprint = (source: string) => string;

export function applyContextPolicies(
  value: unknown,
  config: ContextPolicyConfig,
  fingerprintSource?: ContentFingerprint,
): ContextPolicyResult {
  if (config.killSwitch) {
    return {
      value,
      changed: false,
      decisions: [
        disabledDecision("tool-output", "global-kill-switch"),
        disabledDecision("exact-redundancy", "global-kill-switch"),
        disabledDecision("conversation-compaction", "global-kill-switch"),
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
        disabledDecision("conversation-compaction", "messages-unavailable"),
      ],
    };
  }
  const toolOutput = applyToolOutputPolicy(value.messages, config.toolOutput);
  const redundancy = applyExactRedundancyPolicy(
    toolOutput.messages,
    config.exactRedundancy.enabled,
  );
  const compaction = applyConversationCompactionPolicy(
    redundancy.messages,
    config.conversationCompaction,
    fingerprintSource,
  );
  const changed = toolOutput.changed || redundancy.changed || compaction.changed;
  return {
    value: changed ? { ...value, messages: compaction.messages } : value,
    changed,
    decisions: [toolOutput.decision, redundancy.decision, compaction.decision],
  };
}

export function replayContextPolicies(
  value: unknown,
  config: ContextPolicyConfig,
  fingerprintSource?: ContentFingerprint,
): PolicyReplayResult {
  const result = applyContextPolicies(value, config, fingerprintSource);
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

function applyConversationCompactionPolicy(
  messages: readonly unknown[],
  config: ContextPolicyConfig["conversationCompaction"],
  fingerprintSource?: ContentFingerprint,
): {
  readonly messages: readonly unknown[];
  readonly changed: boolean;
  readonly decision: PolicyDecision;
} {
  if (!config.enabled) {
    return {
      messages,
      changed: false,
      decision: disabledDecision("conversation-compaction", "disabled"),
    };
  }
  if (messages.length < config.minimumMessages) {
    return {
      messages,
      changed: false,
      decision: disabledDecision("conversation-compaction", "below-message-threshold"),
    };
  }
  let activeStart = Math.max(0, messages.length - config.activeWindowMessages);
  while (
    activeStart > 0 &&
    messageRole(messages[activeStart]) === "tool"
  ) {
    activeStart -= 1;
  }
  const oldIndexes = messages
    .map((_message, index) => index)
    .filter(
      (index) =>
        index < activeStart &&
        isRecord(messages[index]) &&
        messages[index]?.role !== "system" &&
        messages[index]?.role !== "developer",
    );
  if (oldIndexes.length === 0) {
    return {
      messages,
      changed: false,
      decision: disabledDecision("conversation-compaction", "no-eligible-old-turns"),
    };
  }
  const oldMessages = oldIndexes.map((index) => messages[index]);
  const sourceJson = JSON.stringify(oldMessages);
  if (sourceJson.length > config.maximumSourceCharacters) {
    return {
      messages,
      changed: false,
      decision: disabledDecision("conversation-compaction", "source-limit-exceeded"),
    };
  }
  if (fingerprintSource === undefined) {
    return {
      messages,
      changed: false,
      decision: disabledDecision("conversation-compaction", "fingerprint-unavailable"),
    };
  }
  const summary = createStructuredSummary(
    oldMessages,
    oldIndexes,
    fingerprintSource(sourceJson),
  );
  const summaryMessage = {
    role: "developer",
    content: [
      "Token Shuffle deterministic compacted state.",
      "Treat retained entries as verbatim prior context; uncertainty means omitted prose may exist.",
      JSON.stringify(summary),
    ].join("\n"),
  };
  const retained = messages.filter(
    (_message, index) => !oldIndexes.includes(index),
  );
  const insertionIndex = retained.findIndex((_message, index) => {
    const originalIndex = messages.indexOf(_message);
    return originalIndex >= activeStart || index === retained.length - 1;
  });
  const candidate = [...retained];
  candidate.splice(Math.max(0, insertionIndex), 0, summaryMessage);
  const candidateJson = JSON.stringify(candidate);
  const originalJson = JSON.stringify(messages);
  if (candidateJson.length >= originalJson.length) {
    return {
      messages,
      changed: false,
      decision: disabledDecision("conversation-compaction", "no-net-reduction"),
    };
  }
  return {
    messages: candidate,
    changed: true,
    decision: {
      policy: "conversation-compaction",
      policyVersion: "v1",
      applied: true,
      reason: "structured-old-turn-summary",
      affectedItems: oldMessages.length,
      charactersRemoved: originalJson.length - candidateJson.length,
      sourceStart: oldIndexes[0],
      sourceEnd: oldIndexes.at(-1),
      sourceFingerprint: summary.sourceFingerprint,
      summaryVersion: summary.version,
      retainedMessages: candidate.length,
    },
  };
}

interface StructuredSummary {
  readonly version: "deterministic-v1";
  readonly sourceRange: { readonly start: number; readonly end: number };
  readonly sourceFingerprint: string;
  readonly objectives: readonly string[];
  readonly constraints: readonly string[];
  readonly filesAndSymbols: readonly string[];
  readonly changedArtifacts: readonly string[];
  readonly failures: readonly string[];
  readonly decisions: readonly string[];
  readonly openQuestions: readonly string[];
  readonly uncertainty: "Non-matching prose was omitted; active window remains verbatim.";
}

function createStructuredSummary(
  messages: readonly unknown[],
  indexes: readonly number[],
  sourceFingerprint: string,
): StructuredSummary {
  const entries = messages.flatMap((message, offset) => {
    if (!isRecord(message) || typeof message.content !== "string") return [];
    return message.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ line, role: String(message.role ?? "unknown"), index: indexes[offset] }));
  });
  const unique = (values: readonly string[]): string[] => [...new Set(values)];
  const label = (entry: { line: string; role: string; index: number | undefined }): string =>
    `[${entry.index ?? "?"}:${entry.role}] ${entry.line}`;
  const matching = (pattern: RegExp): string[] =>
    unique(entries.filter((entry) => pattern.test(entry.line)).map(label));
  const firstUser = entries.find((entry) => entry.role === "user");
  return {
    version: "deterministic-v1",
    sourceRange: {
      start: indexes[0] ?? 0,
      end: indexes.at(-1) ?? 0,
    },
    sourceFingerprint,
    objectives: firstUser === undefined ? [] : [label(firstUser)],
    constraints: matching(/\b(must|should|required|only|never|do not|don't|cannot)\b/i),
    filesAndSymbols: matching(
      /(?:^|\s)(?:[./~][\w./-]+|[\w-]+\/[\w./-]+|[\w-]+\.(?:ts|tsx|js|jsx|json|md|py|rs|go|java|css|html))\b/,
    ),
    changedArtifacts: matching(/\b(created?|changed?|updated?|modified?|deleted?|renamed?)\b/i),
    failures: matching(/\b(error|failed?|failure|exception|timeout|rejected?)\b/i),
    decisions: matching(/\b(decided?|chosen|approved|use|using|selected?)\b/i),
    openQuestions: unique(entries.filter((entry) => entry.line.endsWith("?")).map(label)),
    uncertainty: "Non-matching prose was omitted; active window remains verbatim.",
  };
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

function messageRole(value: unknown): unknown {
  return isRecord(value) ? value.role : undefined;
}
