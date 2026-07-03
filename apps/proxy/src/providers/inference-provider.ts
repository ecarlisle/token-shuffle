import type { Dispatcher } from "undici";

export type IngressProtocol =
  | "openai-chat-completions"
  | "anthropic-messages";
export type ProviderKind = "openai-compatible" | "anthropic";

export interface UpstreamResponse {
  readonly statusCode: number;
  readonly body: Dispatcher.ResponseData["body"];
  readonly headers: Readonly<Record<string, string>>;
}

export interface InferenceProvider {
  readonly protocol: IngressProtocol;
  readonly providerKind: ProviderKind;
  prepareRequest(rawBody: Buffer): Buffer;
  execute(rawBody: Buffer, signal: AbortSignal): Promise<UpstreamResponse>;
  close(): Promise<void>;
}
