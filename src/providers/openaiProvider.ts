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

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  type = 'external' as const;
  baseUrl = 'https://api.openai.com/v1';
  apiKey?: string;
  models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  defaultModel = 'gpt-3.5-turbo';

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.warn('OpenAI provider not available:', error);
      return false;
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice) {
        throw new Error('No response from OpenAI API');
      }

      return {
        content: choice.message?.content || '',
        usage: data.usage,
        model: data.model,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<LLMResponse, void, unknown> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
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
                const choice = parsed.choices?.[0];
                if (choice?.delta?.content) {
                  yield {
                    content: choice.delta.content,
                    model: parsed.model,
                    finishReason: choice.finish_reason,
                  };
                }
              } catch (parseError) {
                console.warn('Failed to parse OpenAI streaming response:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Error in OpenAI streaming:', error);
      throw error;
    }
  }
}
