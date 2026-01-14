// MCP (Message Control Protocol) Types for Poke Integration

export interface MCPMessage {
  id: string;
  type: 'text' | 'file' | 'media';
  content: string;
  timestamp: string;
  sender: {
    id: string;
    name: string;
    platform: 'discord' | 'poke';
  };
  context?: {
    channelId?: string;
    threadId?: string;
    replyToId?: string;
  };
  metadata?: Record<string, any>;
}

export interface MCPWebhookPayload {
  event: 'message.received' | 'message.deleted' | 'message.updated';
  message: MCPMessage;
  signature?: string;
}

export interface MCPResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PokeAPIConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
}
