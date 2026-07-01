import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  applyContextPolicies,
  type ContextPolicyConfig,
  type PolicyDecision,
} from "@token-shuffle/core";

import { TokenShuffleError } from "../errors.js";
import {
  EVENT_SCHEMA_VERSION,
  NoopEventSink,
  type EventSink,
  type ObservationEvent,
  type ObservationEventType,
} from "../observation/events.js";
import type { RawJsonBody } from "../protocol/openai/chat-completions.js";
import type {
  OpenAiCompatibleProvider,
  UpstreamResponse,
} from "../providers/openai-compatible.js";

export interface CoordinatedResponse extends UpstreamResponse {
  readonly requestId: string;
  firstByte(): void;
  complete(responseBytes: number, usage?: ProviderUsage): void;
  fail(error: unknown): void;
  release(): void;
}

export interface ProviderUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cacheReadInputTokens?: number;
}

const DEFAULT_POLICIES: ContextPolicyConfig = {
  killSwitch: false,
  toolOutput: {
    enabled: false,
    collapseRepeatedLinesAfter: 3,
    maximumInputCharacters: 64 * 1024,
  },
  exactRedundancy: { enabled: false },
};

export class ExecutionCoordinator {
  #activeRequests = 0;
  readonly #observations = new Set<RequestObservation>();

  public constructor(
    private readonly provider: OpenAiCompatibleProvider,
    private readonly concurrencyLimit: number,
    private readonly eventSink: EventSink = new NoopEventSink(),
    private readonly mode: "observe" | "optimize" = "observe",
    private readonly policies: ContextPolicyConfig = DEFAULT_POLICIES,
  ) {}

  public async execute(
    body: RawJsonBody,
    signal: AbortSignal,
    suppliedSessionId?: string,
  ): Promise<CoordinatedResponse | undefined> {
    if (this.#activeRequests >= this.concurrencyLimit) {
      return undefined;
    }

    const preparation =
      this.mode === "optimize"
        ? applyContextPolicies(body.parsed, this.policies)
        : { value: body.parsed, changed: false, decisions: [] };
    const preparedBody: RawJsonBody = preparation.changed
      ? {
          parsed: preparation.value,
          raw: Buffer.from(JSON.stringify(preparation.value)),
        }
      : body;
    const observation = new RequestObservation(
      body,
      preparedBody,
      preparation.decisions,
      suppliedSessionId,
      this.eventSink,
    );
    this.#observations.add(observation);
    observation.start();
    this.#activeRequests += 1;
    let cancelled = false;
    const markCancelled = (): void => {
      cancelled = true;
      observation.emit("request.cancelled", {});
    };
    signal.addEventListener("abort", markCancelled, { once: true });

    try {
      const response = await this.provider.chatCompletions(preparedBody.raw, signal);
      let released = false;
      let finished = false;
      return {
        ...response,
        requestId: observation.requestId,
        firstByte: () => observation.firstByte(),
        complete: (responseBytes, usage) => {
          if (!finished) {
            finished = true;
            observation.complete(response.statusCode, responseBytes, usage);
            this.#finishObservation(observation);
          }
        },
        fail: (error) => {
          if (!finished) {
            finished = true;
            observation.fail(error, cancelled);
            this.#finishObservation(observation);
          }
        },
        release: () => {
          if (!released) {
            released = true;
            signal.removeEventListener("abort", markCancelled);
            this.#activeRequests -= 1;
          }
        },
      };
    } catch (error) {
      observation.fail(error, cancelled);
      this.#finishObservation(observation);
      signal.removeEventListener("abort", markCancelled);
      this.#activeRequests -= 1;
      throw error;
    }
  }

  public async close(): Promise<void> {
    await Promise.all([...this.#observations].map((observation) => observation.done()));
  }

  #finishObservation(observation: RequestObservation): void {
    void observation.done().finally(() => this.#observations.delete(observation));
  }
}

class RequestObservation {
  public readonly requestId = randomUUID();
  readonly #attemptId = randomUUID();
  readonly #startedAt = performance.now();
  readonly #model: string;
  readonly #requestBytes: number;
  readonly #baselineInputEstimate: number;
  readonly #forwardedInputEstimate: number;
  readonly #session: ObservationEvent["session"];
  readonly #structuralMetrics: Readonly<Record<string, boolean | number | string | null>>;
  #firstByteRecorded = false;
  #eventChain = Promise.resolve();
  readonly #finished: Promise<void>;
  readonly #markFinished: () => void;

  public constructor(
    baselineBody: RawJsonBody,
    forwardedBody: RawJsonBody,
    private readonly policyDecisions: readonly PolicyDecision[],
    suppliedSessionId: string | undefined,
    private readonly sink: EventSink,
  ) {
    let resolveFinished: (() => void) | undefined;
    this.#finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    this.#markFinished = () => resolveFinished?.();
    this.#model = readModel(baselineBody.parsed);
    this.#requestBytes = baselineBody.raw.byteLength;
    this.#baselineInputEstimate = estimateTokens(baselineBody.raw.byteLength);
    this.#forwardedInputEstimate = estimateTokens(forwardedBody.raw.byteLength);
    this.#structuralMetrics = measureStructure(
      baselineBody.parsed,
      baselineBody.raw.byteLength,
    );
    this.#session = resolveSession(suppliedSessionId);
  }

  public start(): void {
    this.emit("request.received", { requestBytes: this.#requestBytes });
    this.emit("request.measured", {
      baselineInputTokens: this.#baselineInputEstimate,
      forwardedInputTokens: this.#forwardedInputEstimate,
      literalInputTokensAvoided: Math.max(
        0,
        this.#baselineInputEstimate - this.#forwardedInputEstimate,
      ),
      optimizationTokens: 0,
      netTokensAvoided: Math.max(
        0,
        this.#baselineInputEstimate - this.#forwardedInputEstimate,
      ),
      provenance: "estimate",
      ...this.#structuralMetrics,
    });
    for (const decision of this.policyDecisions) {
      this.emit("policy.applied", {
        ...decision,
        optimizationTokens: 0,
      });
    }
    this.emitShadowEvaluation(
      "exact-redundancy",
      numberMetric(this.#structuralMetrics.repeatedInputTokens),
      1,
    );
    this.emitShadowEvaluation(
      "tool-output-compaction",
      numberMetric(this.#structuralMetrics.toolOutputTokens),
      256,
    );
    this.emitShadowEvaluation(
      "dynamic-tool-definition-selection",
      numberMetric(this.#structuralMetrics.toolDefinitionTokens),
      1,
    );
    this.emit("route.selected", { reason: "configured-single-upstream" });
    this.emit("attempt.started", {});
  }

  public firstByte(): void {
    if (!this.#firstByteRecorded) {
      this.#firstByteRecorded = true;
      this.emit("attempt.first_byte", {
        durationMs: roundedDuration(this.#startedAt),
      });
    }
  }

  private emitShadowEvaluation(
    policy: string,
    observedInputTokens: number,
    minimumTokens: number,
  ): void {
    this.emit("policy.shadow_evaluated", {
      applied: false,
      eligible: observedInputTokens >= minimumTokens,
      minimumTokens,
      observedInputTokens,
      policy,
      policyVersion: "shadow-v1",
      retryCount: 0,
      retryInputTokens: 0,
      retryOutputTokens: 0,
      reason:
        observedInputTokens >= minimumTokens
          ? "candidate-scope-observed"
          : "below-candidate-threshold",
    });
  }

  public complete(
    statusCode: number,
    responseBytes: number,
    usage?: ProviderUsage,
  ): void {
    const inputTokens = usage?.inputTokens ?? this.#forwardedInputEstimate;
    const outputTokens = usage?.outputTokens ?? estimateTokens(responseBytes);
    this.emit("attempt.usage", {
      inputTokens,
      outputTokens,
      cacheReadInputTokens: usage?.cacheReadInputTokens ?? 0,
      provenance:
        usage?.inputTokens !== undefined || usage?.outputTokens !== undefined
          ? "provider-reported"
          : "estimate",
    });
    this.emit("attempt.completed", {
      durationMs: roundedDuration(this.#startedAt),
      responseBytes,
      statusCode,
    });
    this.emit("request.completed", {
      durationMs: roundedDuration(this.#startedAt),
      statusCode,
    });
    this.#markFinished();
  }

  public fail(error: unknown, cancelled: boolean): void {
    this.emit("attempt.failed", {
      cancelled,
      errorCode: error instanceof TokenShuffleError ? error.code : "transport_error",
      durationMs: roundedDuration(this.#startedAt),
    }, "redacted-error");
    this.#markFinished();
  }

  public emit(
    type: ObservationEventType,
    data: ObservationEvent["data"],
    retentionClass: ObservationEvent["retentionClass"] = "structural",
  ): void {
    const event: ObservationEvent = {
      schemaVersion: EVENT_SCHEMA_VERSION,
      eventId: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      attemptId: this.#attemptId,
      session: this.#session,
      protocol: "openai-chat-completions",
      provider: "openai-compatible",
      model: this.#model,
      data,
      retentionClass,
    };
    this.#eventChain = this.#eventChain
      .then(() => this.sink.append(event))
      .catch(() => undefined);
  }

  public async done(): Promise<void> {
    await this.#finished;
    await this.#eventChain;
  }
}

function resolveSession(supplied: string | undefined): ObservationEvent["session"] {
  if (supplied === undefined) {
    return {
      id: randomUUID(),
      association: "inferred",
      method: "request",
    };
  }
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) {
    throw new TokenShuffleError(
      400,
      "invalid_request",
      "X-Token-Shuffle-Session-Id must be 1–128 safe identifier characters.",
    );
  }
  return {
    id: supplied,
    association: "explicit",
    method: "x-token-shuffle-session-id",
  };
}

function readModel(parsed: unknown): string {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "model" in parsed &&
    typeof parsed.model === "string"
  ) {
    return parsed.model;
  }
  return "unknown";
}

function estimateTokens(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / 4));
}

function roundedDuration(startedAt: number): number {
  return Math.max(0, Math.round((performance.now() - startedAt) * 1000) / 1000);
}

function measureStructure(
  parsed: unknown,
  totalBytes: number,
): Readonly<Record<string, boolean | number | string | null>> {
  if (typeof parsed !== "object" || parsed === null) return {};
  const record = parsed as Record<string, unknown>;
  const messages = Array.isArray(record.messages) ? record.messages : [];
  const tools = Array.isArray(record.tools) ? record.tools : [];
  const toolDefinitionBytes = byteLengthOf(tools);
  let toolOutputBytes = 0;
  let stablePrefixBytes = 0;
  let repeatedMessageBytes = 0;
  let stablePrefixOpen = true;
  const seenMessages = new Set<string>();

  for (const message of messages) {
    const encoded = safeJson(message);
    if (encoded === undefined) continue;
    const bytes = Buffer.byteLength(encoded);
    if (seenMessages.has(encoded)) repeatedMessageBytes += bytes;
    else seenMessages.add(encoded);
    const isStablePrefixRole =
      typeof message === "object" &&
      message !== null &&
      "role" in message &&
      (message.role === "system" || message.role === "developer");
    if (stablePrefixOpen && isStablePrefixRole) {
      stablePrefixBytes += bytes;
    } else {
      stablePrefixOpen = false;
    }
    if (
      typeof message === "object" &&
      message !== null &&
      "role" in message &&
      message.role === "tool"
    ) {
      toolOutputBytes += bytes;
    }
  }

  return {
    messageCount: messages.length,
    toolDefinitionCount: tools.length,
    toolDefinitionTokens: estimateTokensAllowZero(toolDefinitionBytes),
    toolOutputTokens: estimateTokensAllowZero(toolOutputBytes),
    toolDefinitionTokenShare: ratio(toolDefinitionBytes, totalBytes),
    toolOutputTokenShare: ratio(toolOutputBytes, totalBytes),
    repeatedInputTokens: estimateTokensAllowZero(repeatedMessageBytes),
    stablePrefixTokens: estimateTokensAllowZero(stablePrefixBytes),
    responseCacheEligible:
      record.stream !== true && tools.length === 0 && record.n === undefined,
  };
}

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function byteLengthOf(value: unknown): number {
  const encoded = safeJson(value);
  return encoded === undefined ? 0 : Buffer.byteLength(encoded);
}

function estimateTokensAllowZero(bytes: number): number {
  return bytes === 0 ? 0 : estimateTokens(bytes);
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 10_000) / 10_000;
}

function numberMetric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
