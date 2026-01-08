import { PokeClient, getPokeClient, resetPokeClient } from './pokeClient';
import { MCPMessage } from './types';

// Mock fetch globally
global.fetch = jest.fn();

describe('PokeClient', () => {
  const mockConfig = {
    apiUrl: 'https://api.poke.test',
    apiKey: 'test_api_key',
    webhookSecret: 'test_secret'
  };

  const mockMessage: MCPMessage = {
    id: 'msg_123',
    type: 'text',
    content: 'Test message',
    timestamp: new Date().toISOString(),
    sender: {
      id: 'user_123',
      name: 'TestUser',
      platform: 'discord'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetPokeClient();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const client = new PokeClient(mockConfig);
      expect(client).toBeInstanceOf(PokeClient);
    });

    it('should throw error with invalid API key', () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      expect(() => new PokeClient(invalidConfig)).toThrow('Invalid Poke API key');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'msg_123', success: true })
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const client = new PokeClient(mockConfig);
      const result = await client.sendMessage(mockMessage);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.poke.test/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_api_key',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(mockMessage)
        })
      );
    });

    it('should handle API error response', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const client = new PokeClient(mockConfig);
      const result = await client.sendMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error: 400');
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const client = new PokeClient(mockConfig);
      const result = await client.sendMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should respect rate limiting', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'msg_123' })
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const client = new PokeClient(mockConfig);
      
      // Send many messages quickly to trigger rate limit (more than the 50 allowed)
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(client.sendMessage(mockMessage));
      }
      
      const results = await Promise.all(promises);
      const rateLimitedResults = results.filter(r => r.error === 'Rate limit exceeded');
      
      expect(rateLimitedResults.length).toBeGreaterThan(0);
    });
  });

  describe('sendBatchMessages', () => {
    it('should send multiple messages', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'msg_123' })
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const client = new PokeClient(mockConfig);
      const messages = [mockMessage, { ...mockMessage, id: 'msg_124' }];
      
      const results = await client.sendBatchMessages(messages);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'msg_123' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error'
        });

      const client = new PokeClient(mockConfig);
      const messages = [mockMessage, { ...mockMessage, id: 'msg_124' }];
      
      const results = await client.sendBatchMessages(messages);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('getPokeClient', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create client from environment variables', () => {
      process.env.POKE_API_URL = 'https://api.poke.test';
      process.env.POKE_API_KEY = 'test_key';
      process.env.POKE_WEBHOOK_SECRET = 'test_secret';

      const client = getPokeClient();
      expect(client).toBeInstanceOf(PokeClient);
    });

    it('should throw error when environment variables are missing', () => {
      delete process.env.POKE_API_URL;
      delete process.env.POKE_API_KEY;
      delete process.env.POKE_WEBHOOK_SECRET;

      expect(() => getPokeClient()).toThrow('Missing required Poke environment variables');
    });

    it('should return same instance on multiple calls', () => {
      process.env.POKE_API_URL = 'https://api.poke.test';
      process.env.POKE_API_KEY = 'test_key';
      process.env.POKE_WEBHOOK_SECRET = 'test_secret';

      const client1 = getPokeClient();
      const client2 = getPokeClient();
      expect(client1).toBe(client2);
    });
  });
});
