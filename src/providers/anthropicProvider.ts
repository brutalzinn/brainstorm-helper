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

export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic Claude';
  type = 'external' as const;
  baseUrl = 'https://api.anthropic.com/v1';
  apiKey?: string;
  models = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];
  defaultModel = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });
      return response.ok;
    } catch (error) {
      console.warn('Anthropic provider not available:', error);
      return false;
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key not provided');
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

    const systemMessage = messages.find(msg => msg.role === 'system')?.content;

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          messages: anthropicMessages,
          system: systemMessage,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      
      if (!content) {
        throw new Error('No response from Anthropic API');
      }

      return {
        content,
        usage: data.usage,
        model: data.model,
        finishReason: data.stop_reason,
      };
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<LLMResponse, void, unknown> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key not provided');
    }

    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

    const systemMessage = messages.find(msg => msg.role === 'system')?.content;

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          messages: anthropicMessages,
          system: systemMessage,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  yield {
                    content: parsed.delta.text,
                    model: parsed.model,
                    finishReason: parsed.stop_reason,
                  };
                }
              } catch (parseError) {
                console.warn('Failed to parse Anthropic streaming response:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Error in Anthropic streaming:', error);
      throw error;
    }
  }
}
