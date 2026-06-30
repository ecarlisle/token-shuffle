import { Type, type Static } from "@sinclair/typebox";

const EnvironmentReferenceSchema = Type.Object(
  {
    fromEnv: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const TokenShuffleConfigSchema = Type.Object(
  {
    configVersion: Type.Literal(1),
    mode: Type.Literal("observe"),
    server: Type.Object(
      {
        host: Type.Literal("127.0.0.1"),
        port: Type.Integer({ minimum: 1, maximum: 65_535 }),
      },
      { additionalProperties: false },
    ),
    auth: Type.Object(
      {
        accessToken: EnvironmentReferenceSchema,
      },
      { additionalProperties: false },
    ),
    upstream: Type.Object(
      {
        type: Type.Literal("openai-compatible"),
        baseUrl: Type.String({ minLength: 1 }),
        apiKey: EnvironmentReferenceSchema,
      },
      { additionalProperties: false },
    ),
    storage: Type.Optional(
      Type.Object(
        {
          retainRawContent: Type.Literal(false),
        },
        { additionalProperties: false },
      ),
    ),
    limits: Type.Optional(
      Type.Object(
        {
          requestBodyBytes: Type.Optional(Type.Integer({ minimum: 1 })),
          requestHeaderBytes: Type.Optional(Type.Integer({ minimum: 1 })),
          concurrentInferenceRequests: Type.Optional(Type.Integer({ minimum: 1 })),
          upstreamConnectTimeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
          responseHeaderTimeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
          responseBodyTimeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type TokenShuffleConfigFile = Static<typeof TokenShuffleConfigSchema>;

export interface RuntimeConfig {
  readonly configVersion: 1;
  readonly mode: "observe";
  readonly server: {
    readonly host: "127.0.0.1";
    readonly port: number;
  };
  readonly auth: {
    readonly accessToken: string;
  };
  readonly upstream: {
    readonly type: "openai-compatible";
    readonly baseUrl: URL;
    readonly apiKey: string;
  };
  readonly storage: {
    readonly retainRawContent: false;
  };
  readonly limits: {
    readonly requestBodyBytes: number;
    readonly requestHeaderBytes: number;
    readonly concurrentInferenceRequests: number;
    readonly upstreamConnectTimeoutMs: number;
    readonly responseHeaderTimeoutMs: number;
    readonly responseBodyTimeoutMs: number;
  };
}
