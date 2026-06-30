import { randomUUID } from "node:crypto";

export const EVENT_SCHEMA_VERSION = 1;

export type ObservationEventType =
  | "request.received"
  | "request.measured"
  | "route.selected"
  | "attempt.started"
  | "attempt.first_byte"
  | "attempt.usage"
  | "attempt.completed"
  | "attempt.failed"
  | "request.cancelled"
  | "request.completed"
  | "persistence.degraded";

export interface ObservationEvent {
  readonly schemaVersion: typeof EVENT_SCHEMA_VERSION;
  readonly eventId: string;
  readonly type: ObservationEventType;
  readonly timestamp: string;
  readonly requestId: string;
  readonly attemptId?: string;
  readonly session: {
    readonly id: string;
    readonly association: "explicit" | "inferred";
    readonly method: "x-token-shuffle-session-id" | "request";
  };
  readonly protocol: "openai-chat-completions";
  readonly provider: "openai-compatible";
  readonly model: string;
  readonly data: Readonly<Record<string, boolean | number | string | null>>;
  readonly retentionClass: "structural" | "redacted-error";
}

export interface EventSink {
  append(event: ObservationEvent): Promise<void>;
  close?(): Promise<void>;
}

export class NoopEventSink implements EventSink {
  public async append(_event: ObservationEvent): Promise<void> {}
}

export class ResilientEventSink implements EventSink {
  #totalDroppedEvents = 0;
  #unreportedDroppedEvents = 0;

  public constructor(private readonly target: EventSink) {}

  public get health(): { readonly degraded: boolean; readonly droppedEvents: number } {
    return {
      degraded: this.#unreportedDroppedEvents > 0,
      droppedEvents: this.#totalDroppedEvents,
    };
  }

  public async append(event: ObservationEvent): Promise<void> {
    try {
      await this.target.append(event);
      if (this.#unreportedDroppedEvents > 0) {
        const droppedEvents = this.#unreportedDroppedEvents;
        await this.target.append({
          ...event,
          eventId: randomUUID(),
          type: "persistence.degraded",
          timestamp: new Date().toISOString(),
          data: { droppedEvents },
          retentionClass: "structural",
        });
        this.#unreportedDroppedEvents = 0;
      }
    } catch {
      this.#totalDroppedEvents += 1;
      this.#unreportedDroppedEvents += 1;
    }
  }
}
