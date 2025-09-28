import { LlamaProvider } from './llamaProvider';
import { GeminiProvider } from './geminiProvider';
import { OpenAIProvider } from './openaiProvider';

// Define types directly in this file to avoid import issues
interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

interface LLMRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface LLMProvider {
  name: string;
  type: 'local' | 'external';
  baseUrl: string;
  apiKey?: string;
  models: string[];
  defaultModel: string;
  isAvailable: () => Promise<boolean>;
  generate: (request: LLMRequest) => Promise<LLMResponse>;
  generateStream?: (request: LLMRequest) => AsyncGenerator<LLMResponse, void, unknown>;
}

interface LLMConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
  url?: string;
}

export class LLMProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private currentProvider: string = 'llama';
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize Llama provider (local)
    const llamaProvider = new LlamaProvider();
    this.providers.set('llama', llamaProvider);

    // Initialize Gemini provider (external)
    const geminiProvider = new GeminiProvider(this.config.apiKey);
    this.providers.set('gemini', geminiProvider);

    // Initialize OpenAI provider (external)
    const openaiProvider = new OpenAIProvider(this.config.apiKey);
    this.providers.set('openai', openaiProvider);
  }

  async getAvailableProviders(): Promise<Array<{ name: string; available: boolean; type: 'local' | 'external' }>> {
    const providers = Array.from(this.providers.entries());
    const availability = await Promise.all(
      providers.map(async ([name, provider]) => ({
        name,
        available: await provider.isAvailable(),
        type: provider.type,
      }))
    );
    return availability;
  }

  setProvider(providerName: string): boolean {
    if (this.providers.has(providerName)) {
      this.currentProvider = providerName;
      return true;
    }
    return false;
  }

  getCurrentProvider(): LLMProvider | null {
    return this.providers.get(this.currentProvider) || null;
  }

  getCurrentProviderName(): string {
    return this.currentProvider;
  }

  getProvider(providerName: string): LLMProvider | null {
    return this.providers.get(providerName) || null;
  }

  updateConfig(newConfig: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update provider configurations
    if (newConfig.apiKey) {
      if (this.providers.has('gemini')) {
        this.providers.set('gemini', new GeminiProvider(newConfig.apiKey));
      }
      if (this.providers.has('openai')) {
        this.providers.set('openai', new OpenAIProvider(newConfig.apiKey));
      }
    }
    if (newConfig.url && this.providers.has('llama')) {
      this.providers.set('llama', new LlamaProvider());
    }
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  async testConnection(): Promise<boolean> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      return false;
    }
    return await provider.isAvailable();
  }

  async generate(request: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; model?: string; temperature?: number; maxTokens?: number }): Promise<{ content: string; model?: string; finishReason?: string }> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error(`Provider '${this.currentProvider}' not found`);
    }

    const llmRequest = {
      messages: request.messages,
      model: request.model || this.config.model,
      temperature: request.temperature ?? this.config.temperature,
      maxTokens: request.maxTokens ?? this.config.maxTokens,
    };

    const response = await provider.generate(llmRequest);
    return {
      content: response.content,
      model: response.model,
      finishReason: response.finishReason,
    };
  }

  async generateStream(request: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; model?: string; temperature?: number; maxTokens?: number }): Promise<AsyncGenerator<{ content: string; model?: string; finishReason?: string }, void, unknown>> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error(`Provider '${this.currentProvider}' not found`);
    }

    if (!provider.generateStream) {
      throw new Error(`Provider '${this.currentProvider}' does not support streaming`);
    }

    const llmRequest = {
      messages: request.messages,
      model: request.model || this.config.model,
      temperature: request.temperature ?? this.config.temperature,
      maxTokens: request.maxTokens ?? this.config.maxTokens,
    };

    const stream = provider.generateStream(llmRequest);
    
    return (async function* () {
      for await (const chunk of stream) {
        yield {
          content: chunk.content,
          model: chunk.model,
          finishReason: chunk.finishReason,
        };
      }
    })();
  }
}
