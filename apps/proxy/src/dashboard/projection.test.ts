import { describe, expect, it } from "vitest";

import {
  EVENT_SCHEMA_VERSION,
  type ObservationEvent,
  type ObservationEventType,
} from "../observation/events.js";
import {
  projectDashboard,
  projectRequest,
  projectSession,
} from "./projection.js";

function event(
  type: ObservationEventType,
  data: ObservationEvent["data"],
  timestamp: string,
): ObservationEvent {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId: crypto.randomUUID(),
    type,
    timestamp,
    requestId: "request-1",
    attemptId: "attempt-1",
    session: {
      id: "session-1",
      association: "explicit",
      method: "x-token-shuffle-session-id",
    },
    protocol: "openai-chat-completions",
    provider: "openai-compatible",
    model: "synthetic-model",
    data,
    retentionClass: "structural",
  };
}

describe("projectDashboard", () => {
  it("keeps token, cache, provenance, and latency categories separate", () => {
    const overview = projectDashboard([
      event(
        "request.measured",
        {
          forwardedInputTokens: 120,
          literalInputTokensAvoided: 0,
          provenance: "estimate",
        },
        "2026-06-30T10:00:00.000Z",
      ),
      event(
        "attempt.usage",
        {
          inputTokens: 118,
          outputTokens: 42,
          cacheReadInputTokens: 80,
          cacheWriteInputTokens: 20,
          provenance: "provider-reported",
        },
        "2026-06-30T10:00:01.000Z",
      ),
      event(
        "request.completed",
        { statusCode: 200, durationMs: 1250 },
        "2026-06-30T10:00:02.000Z",
      ),
    ]);

    expect(overview.summary).toEqual({
      requests: 1,
      sessions: 1,
      inputTokens: 118,
      outputTokens: 42,
      literalInputTokensAvoided: 0,
      optimizationTokens: 0,
      netTokensAvoided: 0,
      cacheReadInputTokens: 80,
      cacheWriteInputTokens: 20,
      averageLatencyMs: 1250,
    });
    expect(overview.provenance).toEqual({
      providerReportedRequests: 1,
      estimatedRequests: 0,
    });
    expect(overview.sessions[0]).toMatchObject({
      id: "session-1",
      requests: 1,
      inputTokens: 118,
      outputTokens: 42,
    });
    expect(overview.timeline).toEqual([
      {
        date: "2026-06-30",
        inputTokens: 118,
        outputTokens: 42,
        cacheReadInputTokens: 80,
        cacheWriteInputTokens: 20,
        literalInputTokensAvoided: 0,
      },
    ]);
  });

  it("projects inspectable structural replay and session sequence without raw content", () => {
    const events = [
      event(
        "request.measured",
        {
          baselineInputTokens: 120,
          forwardedInputTokens: 120,
          literalInputTokensAvoided: 0,
          messageCount: 4,
          provenance: "estimate",
        },
        "2026-06-30T10:00:00.000Z",
      ),
      event(
        "request.completed",
        { statusCode: 200, durationMs: 1250 },
        "2026-06-30T10:00:02.000Z",
      ),
    ];

    expect(projectRequest(events, "request-1")).toMatchObject({
      replay: {
        available: false,
        baselineInputTokens: 120,
        forwardedInputTokens: 120,
        optimizationTokens: 0,
      },
      structure: { messageCount: 4 },
      events: [{ type: "request.measured" }, { type: "request.completed" }],
    });
    expect(projectSession(events, "session-1")).toMatchObject({
      id: "session-1",
      method: "x-token-shuffle-session-id",
      requestsList: [{ id: "request-1" }],
    });
    expect(projectRequest(events, "missing")).toBeUndefined();
  });
});
