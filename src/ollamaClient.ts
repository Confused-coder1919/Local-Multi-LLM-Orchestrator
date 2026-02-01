export type OllamaRole = 'system' | 'user' | 'assistant';

export interface OllamaMessage {
  role: OllamaRole;
  content: string;
}

export interface OllamaChatOptions {
  temperature?: number;
  num_predict?: number;
  format?: 'json' | Record<string, unknown>;
}

export interface OllamaClientConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor({ baseUrl, model, timeoutMs }: OllamaClientConfig) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.timeoutMs = timeoutMs ?? 60000;
  }

  async chat(messages: OllamaMessage[], options?: OllamaChatOptions): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const payloadOptions: Record<string, number> = {};
    if (typeof options?.temperature === 'number') {
      payloadOptions.temperature = options.temperature;
    }
    if (typeof options?.num_predict === 'number') {
      payloadOptions.num_predict = options.num_predict;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: payloadOptions,
          ...(options?.format ? { format: options.format } : {})
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        const detail = bodyText ? `: ${bodyText}` : '';
        throw new Error(`Ollama responded with ${response.status} ${response.statusText}${detail}`);
      }

      const data = await response.json();
      const content = data?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('Ollama response missing message.content');
      }

      return content;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.timeoutMs}ms`);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Ollama request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
