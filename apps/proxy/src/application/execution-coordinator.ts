import type { RawJsonBody } from "../protocol/openai/chat-completions.js";
import type {
  OpenAiCompatibleProvider,
  UpstreamResponse,
} from "../providers/openai-compatible.js";

export class ExecutionCoordinator {
  #activeRequests = 0;

  public constructor(
    private readonly provider: OpenAiCompatibleProvider,
    private readonly concurrencyLimit: number,
  ) {}

  public async execute(
    body: RawJsonBody,
    signal: AbortSignal,
  ): Promise<UpstreamResponse | undefined> {
    if (this.#activeRequests >= this.concurrencyLimit) {
      return undefined;
    }

    this.#activeRequests += 1;
    try {
      return await this.provider.chatCompletions(body.raw, signal);
    } finally {
      this.#activeRequests -= 1;
    }
  }
}
