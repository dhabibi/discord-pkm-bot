import { handlePingCommand, handleRecentCommand, commands } from './commands';
import { ChatInputCommandInteraction } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('Ping Command', () => {
  describe('Command Definition', () => {
    it('should have a ping command defined', () => {
      const pingCommand = commands.find(cmd => cmd.name === 'ping');
      expect(pingCommand).toBeDefined();
      expect(pingCommand?.name).toBe('ping');
      expect(pingCommand?.description).toBe('Replies with Pong!');
    });
  });

  describe('handlePingCommand', () => {
    it('should reply with "Pong! 🏓"', async () => {
      // Mock the interaction with minimal required properties
      // Type assertion is necessary as we're creating a partial mock for testing
      const mockInteraction = {
        reply: jest.fn().mockResolvedValue(undefined),
        user: {
          tag: 'TestUser#1234'
        },
        commandName: 'ping'
      } as unknown as ChatInputCommandInteraction;

      // Call the handler
      await handlePingCommand(mockInteraction);

      // Verify the response
      expect(mockInteraction.reply).toHaveBeenCalledWith('Pong! 🏓');
    });

    it('should throw an error if reply fails', async () => {
      // Mock an interaction that fails to reply
      // Type assertion is necessary as we're creating a partial mock for testing
      const mockInteraction = {
        reply: jest.fn().mockRejectedValue(new Error('Reply failed')),
        user: {
          tag: 'TestUser#1234'
        },
        commandName: 'ping'
      } as unknown as ChatInputCommandInteraction;

      // Verify the error is propagated
      await expect(handlePingCommand(mockInteraction)).rejects.toThrow('Reply failed');
    });
  });
});

describe('Recent Command', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Command Definition', () => {
    it('should have a recent command defined', () => {
      const recentCommand = commands.find(cmd => cmd.name === 'recent');
      expect(recentCommand).toBeDefined();
      expect(recentCommand?.name).toBe('recent');
      expect(recentCommand?.description).toBe('Displays the 5 most recent URLs');
    });
  });

  describe('handleRecentCommand', () => {
    it('should reply with error if Supabase configuration is missing', async () => {
      // Remove Supabase env vars
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;

      const mockInteraction = {
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'recent'
      } as unknown as ChatInputCommandInteraction;

      await handleRecentCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Supabase configuration is missing. Please contact the bot administrator.');
    });

    it('should successfully fetch and display recent URLs', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'test-key';

      const mockData = [
        { url: 'https://example.com/1' },
        { url: 'https://example.com/2' },
        { url: 'https://example.com/3' }
      ];

      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockData, error: null })
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const mockInteraction = {
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'recent'
      } as unknown as ChatInputCommandInteraction;

      await handleRecentCommand(mockInteraction);

      expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-key');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('urls');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('url');
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(5);
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        '**Recent URLs:**\n1. https://example.com/1\n2. https://example.com/2\n3. https://example.com/3'
      );
    });

    it('should handle empty database result', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'test-key';

      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const mockInteraction = {
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'recent'
      } as unknown as ChatInputCommandInteraction;

      await handleRecentCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('📭 No URLs found in the database.');
    });

    it('should handle database error', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'test-key';

      const mockError = { message: 'Database error' };
      const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: mockError })
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

      const mockInteraction = {
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'recent'
      } as unknown as ChatInputCommandInteraction;

      await handleRecentCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ Failed to fetch recent URLs from the database.');
    });

    it('should handle unexpected errors', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'test-key';

      (createClient as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const mockInteraction = {
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'recent'
      } as unknown as ChatInputCommandInteraction;

      await handleRecentCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('❌ An unexpected error occurred while fetching recent URLs.');
    });
  });
});
