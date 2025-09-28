import { LLMProviderManager } from '../providers/llmProviderManager';

// Define types directly in this file to avoid import issues
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

interface AgentProcessingResult {
  response: string;
  insights: Insight[];
  ideas: Idea[];
  summaryPoints: SummaryPoint[];
  nextStrategy: 'accumulate' | 'summarize' | 'generate';
  shouldGenerateSummary: boolean;
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

export class AgentProcessor {
  private llmManager: LLMProviderManager;
  private processingThreshold = 5; // Process after 5 messages
  private summaryThreshold = 10; // Generate summary after 10 messages

  constructor(llmManager: LLMProviderManager) {
    this.llmManager = llmManager;
  }

  async processMessage(
    message: AgentMessage, 
    context: AgentContext
  ): Promise<AgentProcessingResult> {
    const updatedContext = {
      ...context,
      conversationHistory: [...context.conversationHistory, message],
    };

    // Determine processing strategy based on context
    const strategy = this.determineStrategy(updatedContext);
    
    switch (strategy) {
      case 'accumulate':
        return await this.accumulateContext(message, updatedContext);
      case 'summarize':
        return await this.summarizeContext(updatedContext);
      case 'generate':
        return await this.generateIdeas(message, updatedContext);
      default:
        return await this.accumulateContext(message, updatedContext);
    }
  }

  private determineStrategy(context: AgentContext): 'accumulate' | 'summarize' | 'generate' {
    const messageCount = context.conversationHistory.length;
    
    if (messageCount >= this.summaryThreshold) {
      return 'summarize';
    } else if (messageCount >= this.processingThreshold) {
      return 'generate';
    } else {
      return 'accumulate';
    }
  }

  private async accumulateContext(
    message: AgentMessage, 
    context: AgentContext
  ): Promise<AgentProcessingResult> {
    const prompt = this.buildAccumulationPrompt(message, context);
    
    const response = await this.llmManager.generate({
      messages: [
        { role: 'system', content: 'You are an AI brainstorming agent that accumulates context and extracts insights from conversations.' },
        { role: 'user', content: prompt }
      ]
    });

    const parsed = this.parseAgentResponse(response.content);
    
    return {
      response: parsed.response,
      insights: parsed.insights || [],
      ideas: parsed.ideas || [],
      summaryPoints: parsed.summaryPoints || [],
      nextStrategy: 'accumulate',
      shouldGenerateSummary: context.conversationHistory.length >= this.summaryThreshold,
    };
  }

  private async summarizeContext(context: AgentContext): Promise<AgentProcessingResult> {
    const prompt = this.buildSummaryPrompt(context);
    
    const response = await this.llmManager.generate({
      messages: [
        { role: 'system', content: 'You are an AI brainstorming agent that creates comprehensive summaries and identifies key patterns.' },
        { role: 'user', content: prompt }
      ]
    });

    const parsed = this.parseAgentResponse(response.content);
    
    return {
      response: parsed.response,
      insights: parsed.insights || [],
      ideas: parsed.ideas || [],
      summaryPoints: parsed.summaryPoints || [],
      nextStrategy: 'generate',
      shouldGenerateSummary: true,
    };
  }

  private async generateIdeas(
    message: AgentMessage, 
    context: AgentContext
  ): Promise<AgentProcessingResult> {
    const prompt = this.buildGenerationPrompt(message, context);
    
    const response = await this.llmManager.generate({
      messages: [
        { role: 'system', content: 'You are an AI brainstorming agent that generates creative ideas based on accumulated context.' },
        { role: 'user', content: prompt }
      ]
    });

    const parsed = this.parseAgentResponse(response.content);
    
    return {
      response: parsed.response,
      insights: parsed.insights || [],
      ideas: parsed.ideas || [],
      summaryPoints: parsed.summaryPoints || [],
      nextStrategy: 'accumulate',
      shouldGenerateSummary: context.conversationHistory.length >= this.summaryThreshold,
    };
  }

  async generateMarkdownSummary(context: AgentContext): Promise<MarkdownSummary> {
    const prompt = this.buildMarkdownSummaryPrompt(context);
    
    const response = await this.llmManager.generate({
      messages: [
        { role: 'system', content: 'You are an AI brainstorming agent that creates comprehensive markdown summaries for brainstorming sessions.' },
        { role: 'user', content: prompt }
      ]
    });

    const parsed = this.parseMarkdownSummary(response.content);
    
    return {
      title: parsed.title || `Brainstorm Session - ${new Date().toLocaleDateString()}`,
      overview: parsed.overview || 'No overview available',
      keyInsights: parsed.keyInsights || [],
      generatedIdeas: parsed.generatedIdeas || [],
      actionItems: parsed.actionItems || [],
      questions: parsed.questions || [],
      nextSteps: parsed.nextSteps || [],
      createdAt: new Date(),
    };
  }

  private buildAccumulationPrompt(message: AgentMessage, context: AgentContext): string {
    const recentMessages = context.conversationHistory.slice(-5);
    const conversationText = recentMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `You are a helpful brainstorming assistant. Continue this conversation naturally and help the user explore their ideas.

Recent conversation:
${conversationText}

User's latest message: ${message.content}

Please respond naturally to continue the brainstorming conversation. Be encouraging, ask follow-up questions, and help them explore their ideas further. Keep your response conversational and helpful.

IMPORTANT: Respond ONLY with a natural conversational message. Do not use any special formatting, JSON, or code blocks. Just talk to the user like a helpful brainstorming partner.`;
  }

  private buildSummaryPrompt(context: AgentContext): string {
    const conversationText = context.conversationHistory
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `Create a comprehensive summary of this brainstorming session:

Conversation:
${conversationText}

Existing insights: ${context.extractedInsights.length}
Existing ideas: ${context.generatedIdeas.length}

Please:
1. Provide a thoughtful summary of the conversation
2. Extract key insights and patterns
3. Identify the most important ideas
4. Suggest action items and next steps

Respond in JSON format:
{
  "response": "your summary response",
  "insights": [
    {
      "id": "insight_1",
      "content": "insight description",
      "category": "technical|creative|strategic|practical",
      "confidence": 0.9,
      "sourceMessageId": "summary"
    }
  ],
  "ideas": [
    {
      "id": "idea_1",
      "title": "idea title",
      "description": "idea description",
      "category": "category name",
      "priority": "high|medium|low"
    }
  ],
  "summaryPoints": [
    {
      "id": "point_1",
      "title": "point title",
      "content": "point content",
      "type": "insight|idea|action|question",
      "priority": 1
    }
  ]
}`;
  }

  private buildGenerationPrompt(message: AgentMessage, context: AgentContext): string {
    const recentMessages = context.conversationHistory.slice(-3);
    const conversationText = recentMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `Generate creative ideas based on this brainstorming context:

Recent conversation:
${conversationText}

Current message: ${message.content}

Existing insights: ${context.extractedInsights.length}
Existing ideas: ${context.generatedIdeas.length}

Please:
1. Respond with enthusiasm and build on the ideas
2. Generate 2-3 creative ideas based on the context
3. Extract any new insights
4. Suggest practical next steps

Respond in JSON format:
{
  "response": "your enthusiastic response",
  "insights": [
    {
      "id": "insight_1",
      "content": "insight description",
      "category": "technical|creative|strategic|practical",
      "confidence": 0.8,
      "sourceMessageId": "${message.id}"
    }
  ],
  "ideas": [
    {
      "id": "idea_1",
      "title": "idea title",
      "description": "idea description",
      "category": "category name",
      "priority": "high|medium|low"
    }
  ],
  "summaryPoints": [
    {
      "id": "point_1",
      "title": "point title",
      "content": "point content",
      "type": "insight|idea|action|question",
      "priority": 1
    }
  ]
}`;
  }

  private buildMarkdownSummaryPrompt(context: AgentContext): string {
    const conversationText = context.conversationHistory
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `You are a brainstorming AI assistant. Your task is to process the ENTIRE message queue and generate a comprehensive brainstorm in markdown format.

IMPORTANT: You must analyze ALL messages in the conversation history to create a complete brainstorm. This is not just a summary - it's a creative synthesis of all ideas shared.

Complete conversation history (process ALL messages):
${conversationText}

Existing extracted insights: ${context.extractedInsights.length}
Existing generated ideas: ${context.generatedIdeas.length}
Existing summary points: ${context.summaryPoints.length}

Your task is to:
1. Process and synthesize ALL messages from the entire conversation
2. Extract key themes, patterns, and insights from the complete message queue
3. Generate a comprehensive brainstorm that builds upon ALL ideas shared
4. Create actionable next steps based on the full conversation context
5. Identify connections between different ideas across the entire session

Create a structured markdown document that represents a complete brainstorm session:

Respond in JSON format:
{
  "title": "Comprehensive Brainstorm Session Title",
  "overview": "Executive summary synthesizing ALL ideas from the complete conversation",
  "keyInsights": [
    {
      "id": "insight_1",
      "title": "Key Insight Title",
      "content": "Detailed insight derived from processing the entire message queue",
      "type": "insight",
      "priority": 1
    }
  ],
  "generatedIdeas": [
    {
      "id": "idea_1",
      "title": "Synthesized Idea Title",
      "description": "Comprehensive idea that builds upon ALL messages in the queue",
      "category": "category name",
      "priority": "high|medium|low"
    }
  ],
  "actionItems": [
    {
      "id": "action_1",
      "title": "Action Item",
      "content": "Actionable step based on the complete conversation analysis",
      "type": "action",
      "priority": 1
    }
  ],
  "questions": [
    {
      "id": "question_1",
      "title": "Open Question",
      "content": "Question that emerges from processing the entire message queue",
      "type": "question",
      "priority": 1
    }
  ],
  "nextSteps": [
    "Step 1: Based on complete conversation analysis",
    "Step 2: Building upon all ideas shared"
  ]
}`;
  }

  private parseAgentResponse(content: string): any {
    try {
      // First try to parse as-is
      return JSON.parse(content);
    } catch (error) {
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        
        // Try to find JSON object in the content
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const jsonStr = content.substring(jsonStart, jsonEnd + 1);
          return JSON.parse(jsonStr);
        }
        
        // If all parsing fails, return a conversational response
        console.warn('Failed to parse agent response as JSON, using as plain text:', error);
        return {
          response: content.replace(/```json\s*|\s*```/g, '').trim(),
          insights: [],
          ideas: [],
          summaryPoints: [],
        };
      } catch (secondError) {
        console.error('Failed to parse agent response:', secondError);
        return {
          response: content.replace(/```json\s*|\s*```/g, '').trim(),
          insights: [],
          ideas: [],
          summaryPoints: [],
        };
      }
    }
  }

  private parseMarkdownSummary(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse markdown summary:', error);
      return {
        title: 'Brainstorm Session',
        overview: content,
        keyInsights: [],
        generatedIdeas: [],
        actionItems: [],
        questions: [],
        nextSteps: [],
      };
    }
  }
}
