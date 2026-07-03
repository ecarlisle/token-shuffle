import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { TokenShuffleError } from "../../errors.js";
import type { RawJsonBody } from "../openai/chat-completions.js";

const MessagesRequestSchema = Type.Object(
  {
    model: Type.String({ minLength: 1 }),
    messages: Type.Array(Type.Unknown()),
    max_tokens: Type.Integer({ minimum: 1 }),
    stream: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: true },
);

export function validateAnthropicMessagesRequest(body: RawJsonBody): void {
  if (!Value.Check(MessagesRequestSchema, body.parsed)) {
    throw new TokenShuffleError(
      400,
      "invalid_request",
      "Anthropic Messages requests require model, messages, and max_tokens.",
    );
  }
}
