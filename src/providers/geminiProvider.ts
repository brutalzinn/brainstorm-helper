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
  dynamicModels?: boolean;
  fetchModels?: () => Promise<string[]>;
  isAvailable: () => Promise<boolean>;
  generate: (request: LLMRequest) => Promise<LLMResponse>;
  generateStream?: (request: LLMRequest) => AsyncGenerator<LLMResponse, void, unknown>;
}

export class GeminiProvider implements LLMProvider {
  name = 'Google Gemini';
  type = 'external' as const;
  baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  apiKey?: string;
  models: string[] = [];
  defaultModel = '';
  dynamicModels = true;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async fetchModels(): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('API key required to fetch Gemini models');
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Gemini models: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      
      console.log('Fetched Gemini models:', data);
      
      const geminiModels = data.models
        ?.filter((model: { name?: string; supportedGenerationMethods?: string[] }) => 
          model.name?.includes('gemini') && 
          model.supportedGenerationMethods?.includes('generateContent')
        )
        ?.map((model: { name?: string }) => 
          model.name?.replace('models/', '') || ''
        )
        ?.filter((name: string) => name) || [];
      
      if (geminiModels.length === 0) {
        throw new Error('No valid Gemini models found in API response');
      }
      
      this.models = geminiModels;
      this.defaultModel = geminiModels[0];
      console.log('Updated Gemini models:', this.models);
      
      return this.models;
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.warn('Gemini provider not available:', error);
      return false;
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    
    if (!this.apiKey) {
      throw new Error('Gemini API key not provided');
    }

    if (!this.models.length || !this.defaultModel) {
      throw new Error('No models available. Please fetch models first by providing an API key.');
    }

    if (model && !this.models.includes(model)) {
      throw new Error(`Model '${model}' not available. Available models: ${this.models.join(', ')}`);
    }

    // Convert messages to Gemini format
    const contents = this.convertMessagesToGeminiFormat(messages);

    try {
      const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: Math.max(0.0, Math.min(1.0, temperature)),
            maxOutputTokens: Math.min(maxTokens, 8192),
            topP: 0.8,
            topK: 40,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API error:', errorData);
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Gemini API response:', data);
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        console.error('No content in Gemini response:', data);
        if (data.candidates?.[0]?.finishReason === 'SAFETY') {
          throw new Error('Response blocked by safety filters');
        }
        throw new Error('No response from Gemini API');
      }

      return {
        content,
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0,
        } : undefined,
        model: model,
        finishReason: data.candidates?.[0]?.finishReason,
      };
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<LLMResponse, void, unknown> {
    const { messages, model = this.defaultModel, temperature = 0.7, maxTokens = 2000 } = request;
    
    if (!this.apiKey) {
      throw new Error('Gemini API key not provided');
    }

    const contents = this.convertMessagesToGeminiFormat(messages);

    try {
      const response = await fetch(`${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
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
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                  yield {
                    content,
                    model: model,
                    finishReason: parsed.candidates?.[0]?.finishReason,
                  };
                }
              } catch (parseError) {
                console.warn('Failed to parse Gemini streaming response:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Error in Gemini streaming:', error);
      throw error;
    }
  }

  private convertMessagesToGeminiFormat(messages: Array<{ role: string; content: string }>): Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }> {
    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }> = [];

    let currentRole: 'user' | 'model' = 'user';
    let currentParts: Array<{ text: string }> = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are typically prepended to the first user message
        if (contents.length === 0) {
          currentParts.push({ text: `System: ${message.content}\n\n` });
        } else {
          // Add system context to the conversation
          currentParts.push({ text: `\n\nSystem: ${message.content}` });
        }
      } else {
        const role = message.role === 'assistant' ? 'model' : 'user';
        
        if (role !== currentRole && currentParts.length > 0) {
          contents.push({
            role: currentRole,
            parts: currentParts,
          });
          currentParts = [];
        }
        
        currentRole = role;
        currentParts.push({ text: message.content });
      }
    }

    if (currentParts.length > 0) {
      contents.push({
        role: currentRole,
        parts: currentParts,
      });
    }

    return contents;
  }
}
