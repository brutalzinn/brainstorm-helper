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

export class LlamaProvider implements LLMProvider {
  name = 'Llama (Ollama)';
  type = 'local' as const;
  baseUrl: string;
  models = ['llama3.1', 'llama3.1:8b', 'llama3.1:70b'];
  defaultModel = 'llama3.1';

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 
      (typeof window !== 'undefined' && import.meta.env.VITE_OLLAMA_URL) ||
      (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
        ? '/api/llama' 
        : 'http://localhost:11434');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.warn('Llama provider not available:', error);
      return false;
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    
    // Convert messages to single prompt for Llama
    const prompt = this.formatMessagesAsPrompt(messages);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        content: data.response || '',
        model: model,
        finishReason: 'stop',
      };
    } catch (error) {
      console.error('Error calling Llama API:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<LLMResponse, void, unknown> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    const prompt = this.formatMessagesAsPrompt(messages);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  yield {
                    content: data.response,
                    model: model,
                    finishReason: data.done ? 'stop' : undefined,
                  };
                }
                if (data.done) return;
              } catch (parseError) {
                console.warn('Failed to parse streaming response:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Error in Llama streaming:', error);
      throw error;
    }
  }

  private formatMessagesAsPrompt(messages: Array<{ role: string; content: string }>): string {
    return messages
      .map(msg => {
        switch (msg.role) {
          case 'system':
            return `System: ${msg.content}`;
          case 'user':
            return `Human: ${msg.content}`;
          case 'assistant':
            return `Assistant: ${msg.content}`;
          default:
            return msg.content;
        }
      })
      .join('\n\n') + '\n\nAssistant:';
  }
}
