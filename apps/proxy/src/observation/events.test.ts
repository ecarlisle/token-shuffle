import { describe, expect, it, vi } from "vitest";

import {
  EVENT_SCHEMA_VERSION,
  ObservableEventSink,
  type EventSink,
  type ObservationEvent,
} from "./events.js";

describe("ObservableEventSink", () => {
  it("publishes an event only after the persistence boundary accepts it", async () => {
    const append = vi.fn<EventSink["append"]>().mockResolvedValue();
    const sink = new ObservableEventSink({ append });
    const listener = vi.fn();
    const unsubscribe = sink.subscribe(listener);
    const event = createEvent();

    await sink.append(event);
    unsubscribe();
    await sink.append({ ...event, eventId: crypto.randomUUID() });

    expect(append).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });
});

function createEvent(): ObservationEvent {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId: crypto.randomUUID(),
    type: "request.received",
    timestamp: new Date().toISOString(),
    requestId: "request-1",
    session: {
      id: "session-1",
      association: "inferred",
      method: "request",
    },
    protocol: "openai-chat-completions",
    provider: "openai-compatible",
    model: "synthetic-model",
    data: {},
    retentionClass: "structural",
  };
}
