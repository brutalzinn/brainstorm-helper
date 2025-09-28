import { useState, useCallback, useRef, useEffect } from 'react';
import { LLMProviderManager } from '../providers/llmProviderManager';
import { AgentProcessor } from '../services/agentProcessor';

// Define types directly in this file to avoid import issues
interface Message {
  id: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system';
  processed?: boolean;
}

interface QueueItem {
  id: string;
  message: Message;
  priority: number;
  addedAt: Date;
}

interface BrainstormStats {
  totalMessages: number;
  processedMessages: number;
  pendingMessages: number;
  ideasGenerated: number;
  lastProcessedAt?: Date;
}

interface BrainstormContext {
  conversationHistory: Message[];
  currentTopic: string;
  generatedIdeas: string[];
  lastContextUpdate: Date;
}

interface AgentContext {
  sessionId: string;
  conversationHistory: AgentMessage[];
  currentTopic: string;
  extractedInsights: Insight[];
  generatedIdeas: Idea[];
  summaryPoints: SummaryPoint[];
  lastProcessedAt: Date;
  processingStrategy: 'accumulate' | 'summarize' | 'generate';
}

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    topic?: string;
    confidence?: number;
    processingTime?: number;
  };
}

interface Insight {
  id: string;
  content: string;
  category: 'technical' | 'creative' | 'strategic' | 'practical';
  confidence: number;
  sourceMessageId: string;
  extractedAt: Date;
}

interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  relatedInsights: string[];
  generatedAt: Date;
}

interface SummaryPoint {
  id: string;
  title: string;
  content: string;
  type: 'insight' | 'idea' | 'action' | 'question';
  priority: number;
  relatedMessages: string[];
}

interface MarkdownSummary {
  title: string;
  overview: string;
  keyInsights: SummaryPoint[];
  generatedIdeas: Idea[];
  actionItems: SummaryPoint[];
  questions: SummaryPoint[];
  nextSteps: string[];
  createdAt: Date;
}

export const useBrainstormQueue = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<BrainstormStats>({
    totalMessages: 0,
    processedMessages: 0,
    pendingMessages: 0,
    ideasGenerated: 0,
  });
  const [context, setContext] = useState<BrainstormContext>({
    conversationHistory: [],
    currentTopic: '',
    generatedIdeas: [],
    lastContextUpdate: new Date(),
  });
  const [agentContext, setAgentContext] = useState<AgentContext>({
    sessionId: `session_${Date.now()}`,
    conversationHistory: [],
    currentTopic: '',
    extractedInsights: [],
    generatedIdeas: [],
    summaryPoints: [],
    lastProcessedAt: new Date(),
    processingStrategy: 'accumulate',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('llama');
  const [availableProviders, setAvailableProviders] = useState<Array<{ name: string; available: boolean; type: 'local' | 'external' }>>([]);
  const [markdownSummary, setMarkdownSummary] = useState<MarkdownSummary | null>(null);
  const processingRef = useRef(false);
  
  // Initialize LLM Provider Manager and Agent Processor
  const [llmManager] = useState(() => new LLMProviderManager({
    provider: 'llama',
    model: 'llama3.1',
    temperature: 0.7,
    maxTokens: 2000,
  }));
  
  const [agentProcessor] = useState(() => new AgentProcessor(llmManager));

  // Add message to queue
  const addMessage = useCallback((content: string) => {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: new Date(),
      type: 'user',
      processed: false,
    };

    const queueItem: QueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      priority: 1, // FIFO priority
      addedAt: new Date(),
    };

    setQueue(prev => [...prev, queueItem]);
    setMessages(prev => [...prev, message]);
    setStats(prev => ({
      ...prev,
      totalMessages: prev.totalMessages + 1,
      pendingMessages: prev.pendingMessages + 1,
    }));
  }, []);

  // Check available providers on mount
  useEffect(() => {
    const checkProviders = async () => {
      const providers = await llmManager.getAvailableProviders();
      setAvailableProviders(providers);
    };
    checkProviders();
  }, [llmManager]);

  // Process entire queue before responding
  const processQueue = useCallback(async () => {
    if (processingRef.current || queue.length === 0) return;

    processingRef.current = true;
    setIsProcessing(true);

    try {
      // Process ALL queued messages at once
      const queuedMessages = queue.map(item => item.message);
      
      // Clear the entire queue
      setQueue([]);
      setStats(prev => ({
        ...prev,
        pendingMessages: 0,
      }));

      // Convert all queued messages to agent messages
      const agentMessages: AgentMessage[] = queuedMessages.map(msg => ({
        id: msg.id,
        role: msg.type === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      // Update agent context with all queued messages
      const updatedAgentContext = {
        ...agentContext,
        conversationHistory: [...agentContext.conversationHistory, ...agentMessages],
        lastProcessedAt: new Date(),
        processingStrategy: 'accumulate' as const,
      };
      setAgentContext(updatedAgentContext);

      // Mark all queued messages as processed and remove them from the queue display
      setMessages(prev => {
        const updated = prev.map(msg => 
          queuedMessages.some(qm => qm.id === msg.id) 
            ? { ...msg, processed: true }
            : msg
        );
        console.log('Messages after marking as processed:', updated.filter(m => m.type === 'user' && !m.processed).length, 'unprocessed');
        return updated;
      });

      // Generate a comprehensive response based on ALL queued messages and conversation history
      const conversationHistory = updatedAgentContext.conversationHistory
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const comprehensivePrompt = `You are a helpful brainstorming assistant. Continue this brainstorming conversation by responding to the user's latest ideas while considering the full conversation context.

Complete conversation history:
${conversationHistory}

Latest user messages (from queue):
${agentMessages.map((msg, index) => `${index + 1}. ${msg.content}`).join('\n')}

Please:
1. Acknowledge their latest ideas while referencing the conversation context
2. Find connections between their new ideas and previous discussion
3. Build upon the brainstorming session so far
4. Ask thoughtful follow-up questions to help them explore further
5. Suggest how they might combine or build upon all their ideas
6. Be encouraging and help them think deeper about their concepts

Respond naturally and conversationally. Don't use any special formatting or JSON. Just be a helpful brainstorming partner who remembers the full conversation.`;

      const response = await llmManager.generate({
        messages: [
          { role: 'system', content: 'You are a helpful brainstorming assistant that maintains conversation context and responds naturally to help users explore their ideas. You remember the full conversation history and build upon previous discussions.' },
          { role: 'user', content: comprehensivePrompt }
        ]
      });

      // Create assistant message with comprehensive response
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: response.content,
        timestamp: new Date(),
        type: 'assistant',
        processed: true,
      };

      // Add assistant response
      setMessages(prev => [...prev, assistantMessage]);
      setStats(prev => ({
        ...prev,
        processedMessages: prev.processedMessages + queuedMessages.length,
        lastProcessedAt: new Date(),
      }));

    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [queue, agentContext, llmManager]);

  // Auto-process queue when new items are added
  useEffect(() => {
    if (queue.length > 0 && !processingRef.current) {
      const timer = setTimeout(() => {
        processQueue();
      }, 500); // Process after 0.5 second delay for faster response
      return () => clearTimeout(timer);
    }
  }, [queue, processQueue]);

  // Switch provider
  const switchProvider = useCallback((providerName: string) => {
    if (llmManager.setProvider(providerName)) {
      setCurrentProvider(providerName);
    }
  }, [llmManager]);

  // Update API key for external providers
  const updateApiKey = useCallback((apiKey: string) => {
    llmManager.updateConfig({ apiKey });
  }, [llmManager]);

  // Remove message from queue
  const removeMessage = useCallback((messageId: string) => {
    console.log('removeMessage called with ID:', messageId);
    setMessages(prev => {
      const filtered = prev.filter(msg => msg.id !== messageId);
      console.log('Messages after removal:', filtered.length);
      return filtered;
    });
    setQueue(prev => {
      const filtered = prev.filter(item => item.message.id !== messageId);
      console.log('Queue after removal:', filtered.length);
      return filtered;
    });
    setStats(prev => ({
      ...prev,
      totalMessages: Math.max(0, prev.totalMessages - 1),
      pendingMessages: Math.max(0, prev.pendingMessages - 1),
    }));
  }, []);

  // Move message up in queue (higher priority)
  const moveMessageUp = useCallback((messageId: string) => {
    console.log('moveMessageUp called with ID:', messageId);
    
    setQueue(prev => {
      const newQueue = [...prev];
      const currentIndex = newQueue.findIndex(item => item.message.id === messageId);
      
      if (currentIndex > 0) {
        // Swap with the item above
        [newQueue[currentIndex], newQueue[currentIndex - 1]] = [newQueue[currentIndex - 1], newQueue[currentIndex]];
        console.log('Queue reordered, new order:', newQueue.map(item => item.message.content));
      }
      
      return newQueue;
    });

    // Also reorder the messages array to match the queue order
    setMessages(prev => {
      const unprocessedMessages = prev.filter(msg => msg.type === 'user' && !msg.processed);
      const processedMessages = prev.filter(msg => msg.type !== 'user' || msg.processed);
      
      // Get the new order from the queue
      const newQueue = [...queue];
      const currentIndex = newQueue.findIndex(item => item.message.id === messageId);
      
      if (currentIndex > 0) {
        // Swap with the item above
        [newQueue[currentIndex], newQueue[currentIndex - 1]] = [newQueue[currentIndex - 1], newQueue[currentIndex]];
        
        // Reorder unprocessed messages to match queue order
        const reorderedUnprocessed = newQueue.map(queueItem => 
          unprocessedMessages.find(msg => msg.id === queueItem.message.id)
        ).filter(Boolean);
        
        return [...reorderedUnprocessed, ...processedMessages];
      }
      
      return prev;
    });
  }, [queue]);

  // Generate markdown summary
  const generateMarkdownSummary = useCallback(async () => {
    if (agentContext.conversationHistory.length === 0) return '';

    try {
      const summary = await agentProcessor.generateMarkdownSummary(agentContext);
      setMarkdownSummary(summary);
      return formatMarkdownSummary(summary);
    } catch (error) {
      console.error('Error generating markdown summary:', error);
      return 'Error generating markdown summary';
    }
  }, [agentContext, agentProcessor]);

  // Format markdown summary for display
  const formatMarkdownSummary = (summary: MarkdownSummary): string => {
    let markdown = `# ${summary.title}\n\n`;
    markdown += `## Overview\n${summary.overview}\n\n`;
    
    if (summary.keyInsights.length > 0) {
      markdown += `## Key Insights\n`;
      summary.keyInsights.forEach((insight, index) => {
        markdown += `${index + 1}. **${insight.title}**\n   ${insight.content}\n\n`;
      });
    }
    
    if (summary.generatedIdeas.length > 0) {
      markdown += `## Generated Ideas\n`;
      summary.generatedIdeas.forEach((idea, index) => {
        markdown += `${index + 1}. **${idea.title}** (${idea.priority})\n   ${idea.description}\n   *Category: ${idea.category}*\n\n`;
      });
    }
    
    if (summary.actionItems.length > 0) {
      markdown += `## Action Items\n`;
      summary.actionItems.forEach((item, index) => {
        markdown += `${index + 1}. **${item.title}**\n   ${item.content}\n\n`;
      });
    }
    
    if (summary.questions.length > 0) {
      markdown += `## Open Questions\n`;
      summary.questions.forEach((question, index) => {
        markdown += `${index + 1}. **${question.title}**\n   ${question.content}\n\n`;
      });
    }
    
    if (summary.nextSteps.length > 0) {
      markdown += `## Next Steps\n`;
      summary.nextSteps.forEach((step, index) => {
        markdown += `${index + 1}. ${step}\n`;
      });
    }
    
    markdown += `\n---\n*Generated on ${summary.createdAt.toLocaleString()}*`;
    
    return markdown;
  };

  return {
    messages,
    queue,
    stats,
    context: agentContext,
    isProcessing,
    currentProvider,
    availableProviders,
    markdownSummary,
    addMessage,
    generateBrainstorm: generateMarkdownSummary,
    switchProvider,
    updateApiKey,
    removeMessage,
    moveMessageUp,
  };
};

// Process message with current LLM provider
async function processWithLLM(message: Message, context: BrainstormContext, llmManager: LLMProviderManager) {
  const conversationContext = context.conversationHistory
    .slice(-10) // Keep last 10 messages for context
    .map(m => `${m.type}: ${m.content}`)
    .join('\n');

  const prompt = `You are a brainstorming assistant. The user is sharing ideas for brainstorming. 

Previous conversation context:
${conversationContext}

New user message: ${message.content}

Please:
1. Respond naturally to continue the brainstorming conversation
2. Extract the main topic if this is a new direction
3. Generate 2-3 related ideas to expand on their input
4. Keep responses concise but helpful

Respond in JSON format:
{
  "response": "your conversational response",
  "topic": "extracted topic or null",
  "ideas": ["idea1", "idea2", "idea3"]
}`;

  try {
    const response = await llmManager.generate({
      messages: [
        { role: 'system', content: 'You are a helpful brainstorming assistant that responds in JSON format.' },
        { role: 'user', content: prompt }
      ]
    });

    const parsed = JSON.parse(response.content);
    
    const assistantMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: parsed.response,
      timestamp: new Date(),
      type: 'assistant',
      processed: true,
    };

    return {
      assistantMessage,
      extractedTopic: parsed.topic,
      generatedIdeas: parsed.ideas || [],
    };
  } catch (error) {
    console.error('Error calling LLM API:', error);
    throw error;
  }
}
