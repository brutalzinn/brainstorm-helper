import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col, Alert, InputGroup, Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { Settings, Key, Link, Cpu, Thermometer, Hash, Save, TestTube, RefreshCw } from 'lucide-react';
import { LLMProvider, LLMConfig, DEFAULT_PROVIDERS } from '../types/llmConfig';
import { OllamaService } from '../services/ollamaService';

interface LLMConfigModalProps {
  show: boolean;
  onHide: () => void;
  currentConfig: LLMConfig;
  onSave: (config: LLMConfig) => void;
  onTest: (config: LLMConfig) => Promise<boolean>;
}

export const LLMConfigModal: React.FC<LLMConfigModalProps> = ({
  show,
  onHide,
  currentConfig,
  onSave,
  onTest
}) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<LLMConfig>(currentConfig);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    const provider = DEFAULT_PROVIDERS.find(p => p.id === config.provider);
    setSelectedProvider(provider || null);
    
    // Fetch models if provider supports dynamic models
    if (provider?.dynamicModels) {
      fetchModels(provider);
    } else {
      setAvailableModels(provider?.supportedModels || []);
    }
  }, [config.provider]);

  const fetchModels = async (provider: LLMProvider) => {
    if (!provider.dynamicModels) return;
    
    setIsLoadingModels(true);
    try {
      const ollamaService = new OllamaService(config.url || provider.defaultUrl);
      const models = await ollamaService.getAvailableModels();
      setAvailableModels(models);
      
      // Update the provider with the fetched models
      const updatedProvider = { ...provider, supportedModels: models };
      setSelectedProvider(updatedProvider);
    } catch (error) {
      console.error('Error fetching models:', error);
      setAvailableModels(provider.supportedModels);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    const provider = DEFAULT_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setConfig({
        ...config,
        provider: providerId,
        model: provider.defaultModel,
        url: provider.defaultUrl || '',
        apiKey: provider.requiresApiKey ? config.apiKey : undefined
      });
      setSelectedProvider(provider);
    }
  };

  const handleSave = () => {
    onSave(config);
    onHide();
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const success = await onTest(config);
      setTestResult({
        success,
        message: success ? 'Connection successful!' : 'Connection failed. Please check your configuration.'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigValid = () => {
    if (!selectedProvider) return false;
    
    if (selectedProvider.requiresApiKey && !config.apiKey?.trim()) return false;
    if (selectedProvider.requiresUrl && !config.url?.trim()) return false;
    if (!config.model?.trim()) return false;
    
    return true;
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" data-bs-theme="dark">
      <Modal.Header closeButton className="bg-dark border-secondary">
        <Modal.Title className="text-white d-flex align-items-center">
          <Settings size={20} className="me-2" />
          LLM Provider Configuration
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark text-white">
        <Form>
          {/* Provider Selection */}
          <Row className="mb-4">
            <Col>
              <Form.Label className="fw-bold">Select Provider</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {DEFAULT_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.id}
                    variant={config.provider === provider.id ? "primary" : "outline-secondary"}
                    size="sm"
                    onClick={() => handleProviderChange(provider.id)}
                    className="d-flex align-items-center"
                    style={{ minHeight: '44px' }}
                  >
                    <span className="me-2">{provider.icon}</span>
                    {provider.name}
                    {provider.available && (
                      <Badge bg="success" className="ms-2">Available</Badge>
                    )}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>

          {selectedProvider && (
            <>
              {/* Provider Info */}
              <Alert variant="info" className="mb-4">
                <strong>{selectedProvider.name}</strong>
                <br />
                {selectedProvider.description}
              </Alert>

              <Row className="mb-3">
                <Col md={6}>
                  {/* API Key */}
                  {selectedProvider.requiresApiKey && (
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <Key size={16} className="me-2" />
                        API Key
                      </Form.Label>
                      <Form.Control
                        type="password"
                        value={config.apiKey || ''}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        placeholder="Enter your API key"
                        className="bg-dark text-white border-secondary"
                      />
                    </Form.Group>
                  )}

                  {/* URL */}
                  {selectedProvider.requiresUrl && (
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <Link size={16} className="me-2" />
                        URL
                      </Form.Label>
                      <Form.Control
                        type="url"
                        value={config.url || ''}
                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                        placeholder={selectedProvider.defaultUrl || "Enter API URL"}
                        className="bg-dark text-white border-secondary"
                      />
                    </Form.Group>
                  )}
                </Col>

                <Col md={6}>
                  {/* Model Selection */}
                  <Form.Group className="mb-3">
                    <Form.Label className="d-flex align-items-center">
                      <Cpu size={16} className="me-2" />
                      Model
                    </Form.Label>
                    <Form.Select
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      className="bg-dark text-white border-secondary"
                    >
                      {selectedProvider.supportedModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* Advanced Settings */}
              <Row className="mb-4">
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="d-flex align-items-center">
                      <Thermometer size={16} className="me-2" />
                      Temperature: {config.temperature}
                    </Form.Label>
                    <Form.Range
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      className="custom-range"
                    />
                    <div className="d-flex justify-content-between text-muted small">
                      <span>0 (Focused)</span>
                      <span>2 (Creative)</span>
                    </div>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="d-flex align-items-center">
                      <Hash size={16} className="me-2" />
                      Max Tokens
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min="100"
                      max="8000"
                      value={config.maxTokens}
                      onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                      className="bg-dark text-white border-secondary"
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Test Connection */}
              <Row className="mb-3">
                <Col>
                  <Button
                    variant="outline-info"
                    onClick={handleTest}
                    disabled={!isConfigValid() || isTesting}
                    className="d-flex align-items-center"
                  >
                    <TestTube size={16} className="me-2" />
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </Button>
                  
                  {testResult && (
                    <Alert 
                      variant={testResult.success ? "success" : "danger"} 
                      className="mt-2"
                    >
                      {testResult.message}
                    </Alert>
                  )}
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer className="bg-dark border-secondary">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={!isConfigValid()}
          className="d-flex align-items-center"
        >
          <Save size={16} className="me-2" />
          Save Configuration
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
