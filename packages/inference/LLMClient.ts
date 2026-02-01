export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
}

export interface LLMClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}
