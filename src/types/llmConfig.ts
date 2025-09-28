export interface LLMProvider {
  id: string;
  name: string;
  type: 'local' | 'external';
  available: boolean;
  requiresApiKey: boolean;
  requiresUrl: boolean;
  defaultUrl?: string;
  supportedModels: string[];
  defaultModel: string;
  description: string;
  icon: string;
  dynamicModels?: boolean; // Flag to indicate if models should be fetched dynamically
}

export interface LLMConfig {
  provider: string;
  apiKey?: string;
  url?: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_PROVIDERS: LLMProvider[] = [
  {
    id: 'llama',
    name: 'Llama (Local)',
    type: 'local',
    available: true,
    requiresApiKey: false,
    requiresUrl: true,
    defaultUrl: 'http://localhost:11434',
    supportedModels: [], // Will be populated dynamically
    defaultModel: 'llama3.1',
    description: 'Local Llama instance via Ollama',
    icon: '🦙',
    dynamicModels: true
  },
  // OpenAI provider disabled
  // {
  //   id: 'openai',
  //   name: 'OpenAI',
  //   type: 'external',
  //   available: false,
  //   requiresApiKey: true,
  //   requiresUrl: false,
  //   supportedModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o'],
  //   defaultModel: 'gpt-4',
  //   description: 'OpenAI API',
  //   icon: '🤖'
  // },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'external',
    available: false,
    requiresApiKey: true,
    requiresUrl: false,
    supportedModels: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-pro',
    description: 'Google Gemini API',
    icon: '💎',
    dynamicModels: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'external',
    available: false,
    requiresApiKey: true,
    requiresUrl: false,
    supportedModels: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1'],
    defaultModel: 'claude-3-sonnet',
    description: 'Anthropic Claude API',
    icon: '🧠'
  },
  {
    id: 'cohere',
    name: 'Cohere',
    type: 'external',
    available: false,
    requiresApiKey: true,
    requiresUrl: false,
    supportedModels: ['command', 'command-light', 'command-nightly', 'command-r'],
    defaultModel: 'command',
    description: 'Cohere API',
    icon: '⚡'
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    type: 'external',
    available: false,
    requiresApiKey: true,
    requiresUrl: true,
    supportedModels: ['custom'],
    defaultModel: 'custom',
    description: 'Custom API endpoint',
    icon: '🔧'
  }
];
