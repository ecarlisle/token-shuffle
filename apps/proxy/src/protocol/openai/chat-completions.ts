import { Value } from "@sinclair/typebox/value";
import { Type } from "@sinclair/typebox";

import { TokenShuffleError } from "../../errors.js";

const ChatCompletionsRequestSchema = Type.Object(
  {
    model: Type.String({ minLength: 1 }),
    messages: Type.Array(Type.Unknown()),
    stream: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: true },
);

export interface RawJsonBody {
  readonly raw: Buffer;
  readonly parsed: unknown;
}

export function parseRawJsonBody(body: Buffer): RawJsonBody {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8")) as unknown;
  } catch {
    throw new TokenShuffleError(400, "invalid_request", "Request body must be valid JSON.");
  }
  return { raw: body, parsed };
}

export function validateChatCompletionsRequest(body: RawJsonBody): void {
  if (!Value.Check(ChatCompletionsRequestSchema, body.parsed)) {
    throw new TokenShuffleError(
      400,
      "invalid_request",
      "Request must contain a model string and messages array.",
    );
  }

  if (body.parsed.stream === true) {
    throw new TokenShuffleError(
      501,
      "streaming_not_supported",
      "Streaming responses are not implemented in this development slice.",
    );
  }
}
