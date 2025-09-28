export class GoogleApiService {
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async getAvailableModels(apiKey: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${apiKey}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Gemini models: ${response.statusText}`);
      }
      const data = await response.json();
      
      const geminiModels = data.models
        ?.filter((model: any) => model.name?.includes('gemini'))
        ?.map((model: any) => model.name?.replace('models/', ''))
        ?.filter((name: string) => name) || [];
      
      return geminiModels;
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      return [];
    }
  }

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${apiKey}`);
      return response.ok;
    } catch (error) {
      console.error('Error testing Gemini connection:', error);
      return false;
    }
  }
}
