import { WebhookServer } from './webhookServer';
import { Client } from 'discord.js';
import request from 'supertest';
import crypto from 'crypto';

// Mock Discord client
const mockClient = {
  channels: {
    fetch: jest.fn()
  }
} as unknown as Client;

describe('WebhookServer', () => {
  let server: WebhookServer;
  const testSecret = 'test_webhook_secret';

  beforeEach(() => {
    jest.clearAllMocks();
    server = new WebhookServer(mockClient, testSecret);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Health endpoint', () => {
    it('should respond to health check', async () => {
      const response = await request(server.getApp())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        service: 'discord-poke-connector'
      });
    });
  });

  describe('API info endpoint', () => {
    it('should return API information', async () => {
      const response = await request(server.getApp())
        .get('/api/info')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'Discord-Poke MCP Connector',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          webhook: '/webhook/poke',
          info: '/api/info'
        }
      });
    });
  });

  describe('Webhook endpoint', () => {
    it('should accept valid webhook with correct signature', async () => {
      const payload = {
        event: 'message.received',
        message: {
          id: 'msg_123',
          type: 'text',
          content: 'Test message',
          timestamp: new Date().toISOString(),
          sender: {
            id: 'user_123',
            name: 'TestUser',
            platform: 'poke'
          }
        }
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(payloadString)
        .digest('hex');

      // Mock channel
      const mockChannel = {
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({})
      };
      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      const response = await request(server.getApp())
        .post('/webhook/poke')
        .set('x-poke-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        event: 'message.received',
        message: {
          id: 'msg_123',
          type: 'text',
          content: 'Test message',
          timestamp: new Date().toISOString(),
          sender: {
            id: 'user_123',
            name: 'TestUser',
            platform: 'poke'
          }
        }
      };

      const response = await request(server.getApp())
        .post('/webhook/poke')
        .set('x-poke-signature', 'invalid_signature_123')
        .send(payload)
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid signature' });
    });

    it('should reject webhook without signature', async () => {
      const payload = {
        event: 'message.received',
        message: {
          id: 'msg_123',
          type: 'text',
          content: 'Test message',
          timestamp: new Date().toISOString(),
          sender: {
            id: 'user_123',
            name: 'TestUser',
            platform: 'poke'
          }
        }
      };

      const response = await request(server.getApp())
        .post('/webhook/poke')
        .send(payload)
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid signature' });
    });

    it('should handle message with channel context', async () => {
      const payload = {
        event: 'message.received',
        message: {
          id: 'msg_123',
          type: 'text',
          content: 'Test message',
          timestamp: new Date().toISOString(),
          sender: {
            id: 'user_123',
            name: 'TestUser',
            platform: 'poke'
          },
          context: {
            channelId: 'channel_123'
          }
        }
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(payloadString)
        .digest('hex');

      const mockChannel = {
        isTextBased: () => true,
        send: jest.fn().mockResolvedValue({})
      };
      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      await request(server.getApp())
        .post('/webhook/poke')
        .set('x-poke-signature', signature)
        .send(payload)
        .expect(200);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel_123');
      expect(mockChannel.send).toHaveBeenCalledWith('**[Poke → TestUser]**: Test message');
    });

    it('should handle message without channel context gracefully', async () => {
      const payload = {
        event: 'message.received',
        message: {
          id: 'msg_123',
          type: 'text',
          content: 'Test message',
          timestamp: new Date().toISOString(),
          sender: {
            id: 'user_123',
            name: 'TestUser',
            platform: 'poke'
          }
        }
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(payloadString)
        .digest('hex');

      const response = await request(server.getApp())
        .post('/webhook/poke')
        .set('x-poke-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Server lifecycle', () => {
    it('should start and stop server', async () => {
      const testServer = new WebhookServer(mockClient, testSecret);
      
      await testServer.start(3001);
      await testServer.stop();
      
      // Server should be stopped, no errors should occur
      expect(true).toBe(true);
    });

    it('should handle stop when server not started', async () => {
      const testServer = new WebhookServer(mockClient, testSecret);
      
      // Should not throw error
      await testServer.stop();
      
      expect(true).toBe(true);
    });
  });
});
