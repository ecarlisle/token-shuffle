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
    mode: Type.Union([Type.Literal("observe"), Type.Literal("optimize")]),
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
        compatibility: Type.Optional(
          Type.Object(
            {
              developerRole: Type.Union([
                Type.Literal("preserve"),
                Type.Literal("system"),
              ]),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
    storage: Type.Optional(
      Type.Object(
        {
          retainRawContent: Type.Literal(false),
          path: Type.Optional(Type.String({ minLength: 1 })),
          contentFingerprintKey: Type.Optional(EnvironmentReferenceSchema),
          structuralRetentionDays: Type.Optional(Type.Integer({ minimum: 1 })),
          errorRetentionDays: Type.Optional(Type.Integer({ minimum: 1 })),
        },
        { additionalProperties: false },
      ),
    ),
    policies: Type.Optional(
      Type.Object(
        {
          killSwitch: Type.Optional(Type.Boolean()),
          toolOutput: Type.Optional(
            Type.Object(
              {
                enabled: Type.Boolean(),
                collapseRepeatedLinesAfter: Type.Optional(
                  Type.Integer({ minimum: 3, maximum: 1_000 }),
                ),
                maximumInputCharacters: Type.Optional(
                  Type.Integer({ minimum: 256, maximum: 16 * 1024 * 1024 }),
                ),
              },
              { additionalProperties: false },
            ),
          ),
          exactRedundancy: Type.Optional(
            Type.Object(
              { enabled: Type.Boolean() },
              { additionalProperties: false },
            ),
          ),
          conversationCompaction: Type.Optional(
            Type.Object(
              {
                enabled: Type.Boolean(),
                minimumMessages: Type.Optional(Type.Integer({ minimum: 4, maximum: 10_000 })),
                activeWindowMessages: Type.Optional(Type.Integer({ minimum: 2, maximum: 1_000 })),
                maximumSourceCharacters: Type.Optional(
                  Type.Integer({ minimum: 1_024, maximum: 16 * 1024 * 1024 }),
                ),
              },
              { additionalProperties: false },
            ),
          ),
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
          sseEventBytes: Type.Optional(Type.Integer({ minimum: 1 })),
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
  readonly mode: "observe" | "optimize";
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
    readonly compatibility?: {
      readonly developerRole: "preserve" | "system";
    };
  };
  readonly storage: {
    readonly retainRawContent: false;
    readonly path: string;
    readonly contentFingerprintKey?: string;
    readonly structuralRetentionDays: number;
    readonly errorRetentionDays: number;
  };
  readonly policies?: {
    readonly killSwitch: boolean;
    readonly toolOutput: {
      readonly enabled: boolean;
      readonly collapseRepeatedLinesAfter: number;
      readonly maximumInputCharacters: number;
    };
    readonly exactRedundancy: {
      readonly enabled: boolean;
    };
    readonly conversationCompaction: {
      readonly enabled: boolean;
      readonly minimumMessages: number;
      readonly activeWindowMessages: number;
      readonly maximumSourceCharacters: number;
    };
  };
  readonly limits: {
    readonly requestBodyBytes: number;
    readonly requestHeaderBytes: number;
    readonly concurrentInferenceRequests: number;
    readonly upstreamConnectTimeoutMs: number;
    readonly responseHeaderTimeoutMs: number;
    readonly responseBodyTimeoutMs: number;
    readonly sseEventBytes: number;
  };
}
