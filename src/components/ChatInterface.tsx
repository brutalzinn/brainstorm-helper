import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Form, InputGroup, Badge, Collapse, Modal, ButtonGroup, ListGroup, ListGroupItem, Alert } from 'react-bootstrap';
import { Send, Brain, MessageSquare, CheckCircle, Lightbulb, Settings, X, Copy, Check, Sparkles, ChevronDown, ChevronRight, Circle, ArrowUp, TestTube, Github, AlertCircle } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LLMConfig } from '../types/llmConfig';

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system';
  processed?: boolean;
}

interface BrainstormStats {
  totalMessages: number;
  processedMessages: number;
  pendingMessages: number;
  ideasGenerated: number;
  lastProcessedAt?: Date;
}

interface BrainstormContext {
  sessionId: string;
  conversationHistory: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: {
      topic?: string;
      confidence?: number;
      processingTime?: number;
    };
  }>;
  currentTopic: string;
  extractedInsights: Array<{
    id: string;
    content: string;
    category: 'technical' | 'creative' | 'strategic' | 'practical';
    confidence: number;
    sourceMessageId: string;
    extractedAt: Date;
  }>;
  generatedIdeas: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    relatedInsights: string[];
    generatedAt: Date;
  }>;
  summaryPoints: Array<{
    id: string;
    title: string;
    content: string;
    type: 'insight' | 'idea' | 'action' | 'question';
    priority: number;
    relatedMessages: string[];
  }>;
  lastProcessedAt: Date;
  processingStrategy: 'accumulate' | 'summarize' | 'generate';
}

interface MarkdownSummary {
  title: string;
  overview: string;
  keyInsights: Array<{
    id: string;
    title: string;
    content: string;
    type: 'insight' | 'idea' | 'action' | 'question';
    priority: number;
    relatedMessages: string[];
  }>;
  generatedIdeas: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    relatedInsights: string[];
    generatedAt: Date;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    content: string;
    type: 'insight' | 'idea' | 'action' | 'question';
    priority: number;
    relatedMessages: string[];
  }>;
  questions: Array<{
    id: string;
    title: string;
    content: string;
    type: 'insight' | 'idea' | 'action' | 'question';
    priority: number;
    relatedMessages: string[];
  }>;
  nextSteps: string[];
  createdAt: Date;
}

interface ChatInterfaceProps {
  messages: Message[];
  stats: BrainstormStats;
  isProcessing: boolean;
  currentProvider: string;
  availableProviders: Array<{ name: string; available: boolean; type: 'local' | 'external' }>;
  context: BrainstormContext;
  markdownSummary: MarkdownSummary | null;
  onSendMessage: (content: string) => void;
  onGenerateBrainstorm: () => Promise<string>;
  onSwitchProvider: (provider: string) => void;
  onUpdateApiKey: (apiKey: string) => void;
  removeMessage: (messageId: string) => void;
  moveMessageUp: (messageId: string) => void;
  autoProcess: boolean;
  onToggleAutoProcess: () => void;
  onProcessQueue: () => void;
  getAvailableModels: () => string[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  stats,
  isProcessing,
  currentProvider,
  availableProviders,
  onSendMessage,
  onGenerateBrainstorm,
  onSwitchProvider,
  onUpdateApiKey,
  removeMessage,
  moveMessageUp,
  autoProcess,
  onToggleAutoProcess,
  onProcessQueue,
  getAvailableModels,
}) => {
  const [input, setInput] = useState('');
  const [brainstormResult, setBrainstormResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [hasConfiguredLLM, setHasConfiguredLLM] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apiKeyUsed, setApiKeyUsed] = useState(false);
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({
    provider: 'llama',
    model: 'llama3.1',
    temperature: 0.7,
    maxTokens: 2000,
    url: 'http://localhost:11434'
  });
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'json'>('markdown');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle mobile keyboard detection
  useEffect(() => {
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const initialHeight = window.screen.height;
      setIsKeyboardOpen(currentHeight < initialHeight * 0.75);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if LLM is configured
  useEffect(() => {
    const hasApiKey = apiKey.trim().length > 0;
    const isLocalProvider = currentProvider === 'llama';
    setHasConfiguredLLM(isLocalProvider || hasApiKey);
  }, [apiKey, currentProvider]);

  // Mobile detection and queue behavior
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setShowQueue(false); // Collapse queue by default on mobile
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
      // Keep focus on input for continuous typing
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, onSendMessage]);

  const handleGenerateBrainstorm = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await onGenerateBrainstorm();
      setBrainstormResult(result);
    } catch (error) {
      console.error('Error generating brainstorm:', error);
      setBrainstormResult('Error generating brainstorm');
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateBrainstorm]);

  const handleApiKeySubmit = useCallback(() => {
    if (apiKey.trim()) {
      onUpdateApiKey(apiKey.trim());
      setApiKeyUsed(true);
      setHasConfiguredLLM(true);
      // Keep settings open so user can configure the model
    }
  }, [apiKey, onUpdateApiKey]);


  const formatTime = useCallback((timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }, []);

  const getProviderDisplayName = useCallback(() => {
    const provider = availableProviders.find(p => p.name === currentProvider);
    if (!provider) return 'AI Assistant';
    
    switch (currentProvider) {
      case 'llama':
        return 'Local Llama';
      case 'gemini':
        return 'Google Gemini';
      case 'openai':
        return 'OpenAI GPT';
      default:
        return provider.name;
    }
  }, [currentProvider, availableProviders]);

  const handleCopyBrainstorm = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(brainstormResult);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy brainstorm:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = brainstormResult;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [brainstormResult]);


  const handleLLMConfigTest = useCallback(async (config: LLMConfig): Promise<boolean> => {
    try {
      // Test the connection with the new config
      const testConfig = {
        provider: config.provider,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        apiKey: config.apiKey,
        url: config.url
      };
      
      // Create a temporary LLM manager to test the connection
      const { LLMProviderManager } = await import('../providers/llmProviderManager');
      const tempManager = new LLMProviderManager(testConfig);
      return await tempManager.testConnection();
    } catch (error) {
      console.error('LLM config test failed:', error);
      return false;
    }
  }, []);


  const unprocessedMessages = messages.filter(msg => msg.type === 'user' && !msg.processed);

  return (
    <Container fluid className="d-flex flex-column h-100 bg-dark text-white p-0" data-bs-theme="dark">
      <Card className="bg-dark border-secondary rounded-0">
        <Card.Body className="py-3">
          <Row className="align-items-center">
            <Col xs="auto">
              <div className="d-flex align-items-center">
                <div className="bg-success rounded-circle d-flex align-items-center justify-content-center me-3" style={{width: '40px', height: '40px'}}>
                  <Brain size={20} className="text-white" />
                </div>
                <div>
                  <h5 className="mb-0 text-white">Brainstorm Helper</h5>
                  <small className="text-success d-flex align-items-center">
                    <div className="bg-success rounded-circle me-1" style={{width: '8px', height: '8px'}}></div>
                    {isProcessing ? 'Processing...' : 'Online'} • {getProviderDisplayName()}
                  </small>
                </div>
              </div>
            </Col>
                <Col xs="auto" className="ms-auto d-flex gap-2">
                  {/* Settings & Configuration */}
              <Button
                variant="outline-info"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="d-flex align-items-center"
                style={{minWidth: '44px', minHeight: '44px'}}
                title="Settings & Configuration"
              >
                <Settings size={16} />
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Queue Section */}
      <Card className="bg-secondary border-secondary rounded-0">
        <Card.Header 
          className="bg-secondary border-secondary"
          onClick={() => setShowQueue(!showQueue)}
          style={{cursor: 'pointer'}}
        >
          <Row className="align-items-center">
            <Col>
              <div className="d-flex align-items-center">
                {showQueue ? <ChevronDown size={14} className="text-muted me-2" /> : <ChevronRight size={14} className="text-muted me-2" />}
                <span className="text-white fw-medium">
                  {unprocessedMessages.length} Queued
                </span>
              </div>
            </Col>
            <Col className="d-flex gap-2">
              {!autoProcess && unprocessedMessages.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onProcessQueue();
                  }}
                  className="d-flex align-items-center justify-content-center flex-grow-1"
                  style={{minHeight: '32px'}}
                  title="Process queue now"
                >
                  Process Queue
                </Button>
              )}
            </Col>
            <Col xs="auto" className="d-flex gap-2">
        <Button
          variant={autoProcess ? "success" : "outline-secondary"}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleAutoProcess();
          }}
          className="d-flex align-items-center justify-content-center"
          style={{minWidth: '80px', minHeight: '32px'}}
          title={autoProcess ? "Switch to Manual Mode" : "Switch to Auto Mode"}
        >
          {autoProcess ? "Auto Mode" : "Manual Mode"}
        </Button>
        {isProcessing && (
          <Badge bg="warning" className="text-dark">
            Processing...
          </Badge>
        )}
            </Col>
          </Row>
        </Card.Header>

        <Collapse in={showQueue}>
          <Card.Body className="p-0">
            {unprocessedMessages.length > 0 ? (
              <ListGroup variant="flush" className="bg-secondary">
                {unprocessedMessages.map((message, index) => (
                  <ListGroupItem 
                    key={message.id} 
                    className="bg-secondary border-secondary d-flex align-items-center py-2"
                  >
                    <Circle size={12} className="text-muted me-3 flex-shrink-0" />
                    <div className="flex-grow-1 text-truncate me-2">
                      <small className="text-white">{message.content}</small>
                      {isProcessing && index === 0 && (
                        <div className="d-flex align-items-center mt-1">
                          <div className="spinner-border spinner-border-sm text-success me-2" role="status">
                            <span className="visually-hidden">Processing...</span>
                          </div>
                          <small className="text-success">Processing...</small>
                        </div>
                      )}
              </div>
                    <ButtonGroup size="sm">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moveMessageUp(message.id);
                        }}
                        disabled={index === 0 || isProcessing}
                        style={{minWidth: '44px', minHeight: '44px'}}
                        title={index === 0 ? "Already at top" : isProcessing ? "Processing..." : "Move up"}
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeMessage(message.id);
                        }}
                        disabled={isProcessing && index === 0}
                        style={{minWidth: '44px', minHeight: '44px'}}
                        title={isProcessing && index === 0 ? "Currently processing" : "Delete from queue"}
                      >
                        <X size={16} />
                      </Button>
                    </ButtonGroup>
                  </ListGroupItem>
                ))}
              </ListGroup>
            ) : (
              <div className="text-center py-4">
                <small className="text-muted">No items in queue</small>
              </div>
            )}

            {/* Stats */}
            <Card.Footer className="bg-secondary border-secondary">
              <Row className="text-center">
                <Col>
                  <div className="d-flex flex-column align-items-center">
                    <MessageSquare size={16} className="text-primary mb-1" />
                    <small className="text-white fw-bold">{stats.totalMessages}</small>
                    <small className="text-muted">Total</small>
                  </div>
                </Col>
                <Col>
                  <div className="d-flex flex-column align-items-center">
                    <CheckCircle size={16} className="text-success mb-1" />
                    <small className="text-white fw-bold">{stats.processedMessages}</small>
                    <small className="text-muted">Done</small>
                  </div>
                </Col>
                <Col>
                  <div className="d-flex flex-column align-items-center">
                    <Lightbulb size={16} className="text-warning mb-1" />
                    <small className="text-white fw-bold">{stats.ideasGenerated}</small>
                    <small className="text-muted">Ideas</small>
            </div>
                </Col>
              </Row>
            </Card.Footer>
          </Card.Body>
        </Collapse>
      </Card>

        {/* Settings Panel */}
      <Collapse in={showSettings}>
        <Card className="bg-secondary border-secondary rounded-0">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="text-white mb-0">Settings & Configuration</h6>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="text-white"
              >
                Close
              </Button>
            </div>
            
            {/* LLM Configuration */}
            <div className="mb-3">
              <h6 className="text-white mb-3">AI Provider Configuration</h6>
            
            {/* Provider Selection */}
              <div className="mb-3">
                <Form.Label className="text-white">Provider</Form.Label>
                <Form.Select
                  value={currentProvider}
                  onChange={(e) => onSwitchProvider(e.target.value)}
                  className="bg-dark text-white border-secondary"
                >
                {availableProviders.map((provider) => (
                    <option key={provider.name} value={provider.name} disabled={!provider.available}>
                      {provider.available ? '✅' : '❌'} {provider.name} ({provider.type === 'local' ? 'Local' : 'External'})
                    </option>
                  ))}
                </Form.Select>
              </div>

              {/* URL Configuration for Local Providers */}
              {currentProvider === 'llama' && (
                <div className="mb-3">
                  <Form.Label className="text-white">Ollama URL</Form.Label>
                  <Form.Control
                    type="text"
                    value={llmConfig.url || 'http://localhost:11434'}
                    onChange={(e) => setLLMConfig(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="http://localhost:11434"
                    className="bg-dark text-white border-secondary"
                  />
                  <Form.Text className="text-muted">
                    URL where your local Ollama instance is running
                  </Form.Text>
            </div>
              )}

              {/* API Key for External Providers */}
            {currentProvider !== 'llama' && (
                <div className="mb-3">
                  <Form.Label className="text-white">API Key for {currentProvider} (Session Only)</Form.Label>
                  <InputGroup>
                    <Form.Control
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter API key (not stored)..."
                      className="bg-dark text-white border-secondary"
                  />
                    <Button
                      variant="success"
                    onClick={handleApiKeySubmit}
                    disabled={!apiKey.trim()}
                    >
                      Use
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-warning">
                    <strong>Security:</strong> API keys are never stored and only used for the current session.
                  </Form.Text>
                  {apiKeyUsed && (
                    <Alert variant="success" className="mt-2">
                      <CheckCircle size={16} className="me-2" />
                      API key configured successfully! Now select your preferred model below.
                    </Alert>
                  )}
                </div>
              )}

              {/* Model Selection */}
              <div className="mb-3">
                <Form.Label className="text-white">Model</Form.Label>
                <Form.Select
                  value={llmConfig.model}
                  onChange={(e) => setLLMConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="bg-dark text-white border-secondary"
                >
                  {(() => {
                    const availableModels = getAvailableModels();
                    if (availableModels.length > 0) {
                      return availableModels.map((model) => {
                        // Create user-friendly display names
                        let displayName = model;
                        if (model.includes('gemini-2.5-pro')) {
                          displayName = model.includes('preview') ? `${model} (Preview)` : `${model} (Advanced)`;
                        } else if (model.includes('gemini-2.5-flash')) {
                          displayName = model.includes('preview') ? `${model} (Preview)` : `${model} (Fast)`;
                        } else if (model.includes('gemini-2.0-flash')) {
                          displayName = model.includes('exp') ? `${model} (Experimental)` : `${model} (Fast)`;
                        } else if (model.includes('gemini-pro-latest')) {
                          displayName = `${model} (Latest)`;
                        } else if (model.includes('gemini-flash-latest')) {
                          displayName = `${model} (Latest)`;
                        }
                        
                        return (
                          <option key={model} value={model}>
                            {displayName}
                          </option>
                        );
                      });
                    } else if (currentProvider === 'llama') {
                      return <option value="llama3.1">llama3.1 (Default)</option>;
                    } else {
                      return <option value="default">No models available</option>;
                    }
                  })()}
                </Form.Select>
                <Form.Text className="text-muted">
                  {currentProvider === 'llama' 
                    ? 'Model running on your local Ollama instance'
                    : getAvailableModels().length > 0 
                      ? `Available models for ${currentProvider}`
                      : 'Click "Use" button to fetch available models'
                  }
                </Form.Text>
              </div>

              {/* Temperature and Max Tokens */}
              <Row className="mb-3">
                <Col>
                  <Form.Group>
                    <Form.Label className="text-white">Temperature: {llmConfig.temperature}</Form.Label>
                    <Form.Range
                      min={0}
                      max={2}
                      step={0.1}
                      value={llmConfig.temperature}
                      onChange={(e) => setLLMConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="form-range"
                    />
                    <Form.Text className="text-muted">Controls randomness (0 = deterministic, 2 = very random)</Form.Text>
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group>
                    <Form.Label className="text-white">Max Tokens: {llmConfig.maxTokens}</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={4000}
                      value={llmConfig.maxTokens}
                      onChange={(e) => setLLMConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                      className="bg-dark text-white border-secondary"
                    />
                    <Form.Text className="text-muted">Maximum response length</Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              {/* Output Format Selection */}
              <div className="mb-3">
                <Form.Label className="text-white">Output Format</Form.Label>
                <div className="d-flex gap-2">
                  <Button
                    variant={outputFormat === 'markdown' ? 'primary' : 'outline-secondary'}
                    onClick={() => setOutputFormat('markdown')}
                    className="flex-grow-1"
                  >
                    📝 Markdown
                  </Button>
                  <Button
                    variant={outputFormat === 'json' ? 'primary' : 'outline-secondary'}
                    onClick={() => setOutputFormat('json')}
                    className="flex-grow-1"
                  >
                    📋 JSON
                  </Button>
                </div>
                <Form.Text className="text-muted">
                  Choose the format for generated brainstorms
                </Form.Text>
              </div>

              {/* Test Connection */}
              <div className="d-flex justify-content-end">
                <Button
                  variant="outline-info"
                  onClick={async () => {
                    const success = await handleLLMConfigTest(llmConfig);
                    if (success) {
                      alert('Connection successful!');
                    } else {
                      alert('Connection failed. Please check your settings.');
                    }
                  }}
                  className="d-flex align-items-center"
                >
                  <TestTube size={16} className="me-1" />
                  Test Connection
                </Button>
          </div>
      </div>
          </Card.Body>
        </Card>
      </Collapse>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-grow-1 overflow-y-auto bg-dark"
        style={{ 
          paddingBottom: isKeyboardOpen ? '80px' : '0px',
          transition: 'padding-bottom 0.3s ease',
          maxHeight: 'calc(100vh - 200px)',
          scrollBehavior: 'smooth'
        }}
      >
        <Container className="py-3" style={{minHeight: '100%'}}>
        {messages.length === 0 ? (
            <div className="text-center py-5">
              <div className="bg-success rounded-circle d-inline-flex align-items-center justify-content-center mb-4" style={{width: '80px', height: '80px'}}>
                <Brain size={40} className="text-white" />
              </div>
              <h4 className="text-white mb-3">Start Brainstorming!</h4>
              <p className="text-muted mb-4">Share your ideas and I'll help you brainstorm creative solutions.</p>
              
              {/* Configuration Button - Only show when not configured */}
              {!hasConfiguredLLM && (
                <div className="d-flex justify-content-center mb-3">
                  <Button
                    variant="warning"
                    size="lg"
                    onClick={() => setShowSettings(true)}
                    className="d-flex align-items-center px-4 py-3"
                    style={{minHeight: '60px', minWidth: '300px'}}
                  >
                    <Settings size={20} className="me-3" />
                    <div className="text-start">
                      <div className="fw-bold">
                        Configure LLM Provider
                      </div>
                      <small className="opacity-75">
                        Click to set up your AI provider
                      </small>
                    </div>
                  </Button>
                </div>
              )}

              {/* Current Provider Info - Only show when configured */}
              {hasConfiguredLLM && (
                <div className="d-flex justify-content-center">
                  <Alert variant="info" className="d-inline-flex align-items-center">
                    <Sparkles size={16} className="me-2" />
                    AI-powered brainstorming with {getProviderDisplayName()}
                  </Alert>
                </div>
              )}
          </div>
        ) : (
            <>
              {errorMessage && (
                <div className="d-flex justify-content-center mb-3">
                  <Alert variant="danger" className="text-center" style={{maxWidth: '80%'}}>
                    <AlertCircle size={16} className="me-2" />
                    <strong>Connection Error:</strong> {errorMessage}
                    <Button 
                      variant="outline-danger" 
                      size="sm" 
                      className="ms-2"
                      onClick={() => setErrorMessage(null)}
                    >
                      Dismiss
                    </Button>
                  </Alert>
                </div>
              )}
              {messages.map((message) => {
              const isUser = message.type === 'user';
              const isAssistant = message.type === 'assistant';
              const isSystem = message.type === 'system';
              
              return (
                <div key={message.id} className={`d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'} mb-3`}>
                  {/* User message - WhatsApp style */}
                  {isUser && (
                    <div className="bg-success text-white p-3 rounded-3" style={{maxWidth: '80%'}}>
                      <p className="mb-1 text-white">{message.content}</p>
                      <small className="text-white opacity-75 d-block text-end">
                        {formatTime(message.timestamp)}
                      </small>
                    </div>
                  )}
                  
                  {/* Assistant message - WhatsApp style */}
                  {isAssistant && (
                    <div className="bg-light text-dark p-3 rounded-3" style={{maxWidth: '80%'}}>
                      <p className="mb-1">{message.content}</p>
                      <small className="text-muted d-block text-end">
                        {formatTime(message.timestamp)}
                      </small>
                    </div>
                  )}
                  
                  {/* System message */}
                  {isSystem && (
                    <div className="w-100 d-flex justify-content-center">
                      <Alert variant="warning" className="text-center" style={{maxWidth: '80%'}}>
                        <p className="mb-1">{message.content}</p>
                        <small className="text-muted">
                  {formatTime(message.timestamp)}
                        </small>
                      </Alert>
                    </div>
                  )}
                </div>
              );
            })
            }
          
          {/* Processing Indicator */}
          {isProcessing && (
            <div className="d-flex justify-content-start mb-3">
              <div className="bg-light text-dark p-3 rounded-3">
                <div className="d-flex align-items-center">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span className="visually-hidden">Processing...</span>
                  </div>
                  <span className="text-muted">Processing queue...</span>
                </div>
              </div>
            </div>
        )}
          
        <div ref={messagesEndRef} />
            </>
          )}
        </Container>
      </div>

      {/* Input Area */}
      <Card className="bg-dark border-secondary rounded-0">
        <Card.Body>
        {/* Generate Brainstorm Button */}
        {messages.length > 0 && (
            <div className="text-center mb-3">
              <Button
                variant="primary"
              onClick={handleGenerateBrainstorm}
                disabled={isGenerating}
                className="px-4 py-2"
                style={{minHeight: '44px'}}
            >
              {isGenerating ? (
                <>
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Generating...</span>
                    </div>
                  Generating...
                </>
              ) : (
                <>
                    <Sparkles size={16} className="me-2" />
                  Generate Brainstorm
                </>
              )}
              </Button>
          </div>
        )}

          {/* Message Input Form */}
          <Form onSubmit={handleSubmit}>
            <InputGroup>
              <Form.Control
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="bg-dark text-white border-secondary"
                style={{color: 'white'}}
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                spellCheck="true"
              />
              <Button
                type="submit"
                variant="success"
                disabled={!input.trim()}
                style={{minWidth: '60px', minHeight: '44px'}}
              >
                <Send size={20} />
              </Button>
            </InputGroup>
          </Form>
        </Card.Body>
      </Card>

      {/* Footer */}
      <Card className="bg-dark border-secondary rounded-0">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-center align-items-center">
            <a
              href="https://github.com/brutalzinn/brainstorm-helper"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none d-flex align-items-center text-muted"
            >
              <Github size={16} className="me-2" />
              <span>View on GitHub</span>
            </a>
      </div>
        </Card.Body>
      </Card>

      {/* Brainstorm Result Modal */}
      <Modal show={!!brainstormResult} onHide={() => setBrainstormResult('')} size="lg" data-bs-theme="dark">
        <Modal.Header closeButton className="bg-dark border-secondary">
          <Modal.Title className="text-white">
            <div className="d-flex align-items-center">
              <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-3" style={{width: '40px', height: '40px'}}>
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h5 className="mb-0">Generated Brainstorm</h5>
                <small className="text-muted">Based on your conversation</small>
              </div>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white">
              <MarkdownRenderer content={brainstormResult} />
        </Modal.Body>
        <Modal.Footer className="bg-dark border-secondary">
          <Button
            variant="outline-secondary"
            onClick={handleCopyBrainstorm}
            className="me-2"
          >
            {isCopied ? <Check size={20} className="me-2" /> : <Copy size={20} className="me-2" />}
            {isCopied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="secondary" onClick={() => setBrainstormResult('')}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

    </Container>
  );
};