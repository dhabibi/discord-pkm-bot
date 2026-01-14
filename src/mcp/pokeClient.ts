import { MCPMessage, MCPResponse, PokeAPIConfig } from './types';
import { createAuthHeader, validateApiKey } from './auth';

/**
 * Rate limiter to prevent overwhelming the Poke API
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 50, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    // Record request atomically with the check
    this.requests.push(now);
    return true;
  }
}

export class PokeClient {
  private config: PokeAPIConfig;
  private rateLimiter: RateLimiter;

  constructor(config: PokeAPIConfig) {
    if (!validateApiKey(config.apiKey)) {
      throw new Error('Invalid Poke API key');
    }
    this.config = config;
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Send a message to Poke
   */
  async sendMessage(message: MCPMessage): Promise<MCPResponse> {
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      console.warn('[WARN] Rate limit exceeded for Poke API');
      return {
        success: false,
        error: 'Rate limit exceeded'
      };
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/messages`, {
        method: 'POST',
        headers: createAuthHeader(this.config.apiKey),
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ERROR] Poke API error (${response.status}):`, errorText);
        return {
          success: false,
          error: `API error: ${response.status}`
        };
      }

      const data = await response.json() as any;
      return {
        success: true,
        messageId: data.id || data.messageId
      };
    } catch (error) {
      console.error('[ERROR] Failed to send message to Poke:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send multiple messages in batch
   */
  async sendBatchMessages(messages: MCPMessage[]): Promise<MCPResponse[]> {
    const results: MCPResponse[] = [];
    
    for (const message of messages) {
      const result = await this.sendMessage(message);
      results.push(result);
      
      // Small delay between batch requests to avoid rate limiting
      if (messages.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
}

// Singleton instance
let pokeClientInstance: PokeClient | null = null;

export function getPokeClient(): PokeClient {
  const apiUrl = process.env.POKE_API_URL;
  const apiKey = process.env.POKE_API_KEY;
  const webhookSecret = process.env.POKE_WEBHOOK_SECRET;

  if (!apiUrl || !apiKey || !webhookSecret) {
    throw new Error('Missing required Poke environment variables: POKE_API_URL, POKE_API_KEY, and/or POKE_WEBHOOK_SECRET');
  }

  if (!pokeClientInstance) {
    pokeClientInstance = new PokeClient({
      apiUrl,
      apiKey,
      webhookSecret
    });
  }

  return pokeClientInstance;
}

export function resetPokeClient(): void {
  pokeClientInstance = null;
}
