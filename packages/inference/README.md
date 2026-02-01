# Inference Package

This package defines a minimal, provider-agnostic interface for local model inference.

## Provider Integration
- Implement the `LLMClient` interface from `packages/inference/LLMClient.ts`.
- Keep provider-specific code in `packages/inference/providers/<provider>.ts` (to be added).
- The orchestrator and services should depend only on the `LLMClient` interface.

## Example Shape
```ts
import { LLMClient, ChatMessage, ChatOptions } from './LLMClient';

export class LocalProviderClient implements LLMClient {
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    // TODO: connect to local runtime (Ollama later).
    return '';
  }
}
```

No runtime dependencies are introduced here. This is only a type contract stub.
