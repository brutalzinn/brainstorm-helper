# Brainstorm Helper

A React TypeScript SPA for AI-powered brainstorming with queue-based message processing and support for multiple LLM providers.

## Features

- **FIFO Queue System**: Messages are processed in order with context conversation
- **Multiple LLM Providers**: Support for Llama 3.1 (local) and Google Gemini (external)
- **Real-time Stats**: Track messages, processing status, and generated ideas
- **Dark Mode UI**: Modern, responsive interface with dark theme
- **Context-Aware**: Maintains conversation context for coherent brainstorming
- **Brainstorm Generation**: Generate comprehensive brainstorm documents from conversations

## Prerequisites

### For Llama 3.1 (Local)
1. Install [Ollama](https://ollama.ai/)
2. Pull the Llama 3.1 model:
   ```bash
   ollama pull llama3.1
   ```
3. Start Ollama server:
   ```bash
   ollama serve
   ```

### For Google Gemini (External)
1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Enter the API key in the app settings

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd brainstorm-helper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Start Brainstorming**: Type your ideas in the input field and press Enter
2. **Queue Processing**: Messages are automatically processed through the FIFO queue
3. **Provider Selection**: Click the settings icon to switch between Llama and Gemini
4. **API Key Setup**: For external providers, enter your API key in the settings
5. **Generate Brainstorm**: Click "Generate Brainstorm" to create a comprehensive document

## Architecture

### Components
- `ChatInterface`: Main chat UI with stats and settings
- `useBrainstormQueue`: Custom hook managing queue and LLM integration
- `LLMProviderManager`: Manages different LLM providers
- Provider implementations for Llama and Gemini

### Queue System
- FIFO (First In, First Out) processing
- Context conversation management
- Automatic idea generation and topic extraction
- Real-time status updates

### LLM Integration
- Flexible provider system
- Support for local (Llama) and external (Gemini) providers
- Streaming and non-streaming responses
- Error handling and fallbacks

## Development

### Project Structure
```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── providers/          # LLM provider implementations
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

### Key Features
- TypeScript for type safety
- Tailwind CSS for styling
- React hooks for state management
- Axios for HTTP requests
- Lucide React for icons

## Configuration

The app supports configuration through the settings panel:
- **Provider Selection**: Switch between available LLM providers
- **API Keys**: Configure external provider API keys
- **Model Selection**: Choose specific models for each provider

## Troubleshooting

### Llama Not Working
- Ensure Ollama is running: `ollama serve`
- Check if the model is installed: `ollama list`
- Verify the model name matches the configuration

### Gemini Not Working
- Verify your API key is correct
- Check your API quota and billing
- Ensure the model name is supported

### General Issues
- Check browser console for errors
- Verify network connectivity
- Restart the development server if needed

## Contributing

1. Follow the React best practices outlined in `.cursorrules`
2. Use TypeScript for all new code
3. Follow the existing component patterns
4. Test with both local and external providers
5. Update documentation for new features

## License

This project is open source and available under the MIT License.