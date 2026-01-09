import { handlePingCommand, handleSaveCommand, handleToggleAutosaveCommand, handleCheckAutosaveCommand, handleIngestAllCommand, commands } from './commands';
import { ChatInputCommandInteraction, Collection, Message, TextChannel } from 'discord.js';
import { saveLink, saveDiscordLinks } from './supabase';
import { toggleAutosave, isAutosaveEnabled, clearAutosaveSettings } from './autosave';

// Mock dependencies
jest.mock('./supabase');
jest.mock('./autosave');

describe('Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Definitions', () => {
    it('should have a ping command defined', () => {
      const pingCommand = commands.find(cmd => cmd.name === 'ping');
      expect(pingCommand).toBeDefined();
      expect(pingCommand?.name).toBe('ping');
      expect(pingCommand?.description).toBe('Replies with Pong!');
    });

    it('should have a save command defined', () => {
      const saveCommand = commands.find(cmd => cmd.name === 'save');
      expect(saveCommand).toBeDefined();
      expect(saveCommand?.name).toBe('save');
      expect(saveCommand?.description).toBe('Save a URL to the database');
    });

    it('should have a toggle-autosave command defined', () => {
      const toggleCommand = commands.find(cmd => cmd.name === 'toggle-autosave');
      expect(toggleCommand).toBeDefined();
      expect(toggleCommand?.name).toBe('toggle-autosave');
      expect(toggleCommand?.description).toBe('Toggle autosave for links in this channel');
    });

    it('should have a check-autosave command defined', () => {
      const checkCommand = commands.find(cmd => cmd.name === 'check-autosave');
      expect(checkCommand).toBeDefined();
      expect(checkCommand?.name).toBe('check-autosave');
      expect(checkCommand?.description).toBe('Check if autosave is enabled for this channel');
    });

    it('should have an ingest-all command defined', () => {
      const ingestCommand = commands.find(cmd => cmd.name === 'ingest-all');
      expect(ingestCommand).toBeDefined();
      expect(ingestCommand?.name).toBe('ingest-all');
      expect(ingestCommand?.description).toBe('Extract all links from channel history and save to database');
    });
  });

  describe('handlePingCommand', () => {
    it('should reply with "Pong! 🏓"', async () => {
      const mockInteraction = {
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'ping'
      } as unknown as ChatInputCommandInteraction;

      await handlePingCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith('Pong! 🏓');
    });

    it('should throw an error if reply fails', async () => {
      const mockInteraction = {
        reply: jest.fn().mockRejectedValue(new Error('Reply failed')),
        user: { tag: 'TestUser#1234' },
        commandName: 'ping'
      } as unknown as ChatInputCommandInteraction;

      await expect(handlePingCommand(mockInteraction)).rejects.toThrow('Reply failed');
    });
  });

  describe('handleSaveCommand', () => {
    it('should save a URL successfully', async () => {
      const mockUrl = 'https://example.com';
      const mockLink = { url: mockUrl, created_at: '2024-01-01' };
      (saveLink as jest.Mock).mockResolvedValue({ data: mockLink, error: null });

      const mockInteraction = {
        options: {
          getString: jest.fn().mockReturnValue(mockUrl)
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'save'
      } as unknown as ChatInputCommandInteraction;

      await handleSaveCommand(mockInteraction);

      expect(mockInteraction.options.getString).toHaveBeenCalledWith('url', true);
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(saveLink).toHaveBeenCalledWith(mockUrl);
      expect(mockInteraction.editReply).toHaveBeenCalledWith(`✅ Link saved: ${mockUrl}`);
    });

    it('should handle database errors', async () => {
      const mockUrl = 'https://example.com';
      const mockError = { message: 'Database error' };
      (saveLink as jest.Mock).mockResolvedValue({ data: null, error: mockError });

      const mockInteraction = {
        options: {
          getString: jest.fn().mockReturnValue(mockUrl)
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'save'
      } as unknown as ChatInputCommandInteraction;

      await handleSaveCommand(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(saveLink).toHaveBeenCalledWith(mockUrl);
      expect(mockInteraction.editReply).toHaveBeenCalledWith('❌ Failed to save link. Please try again.');
    });
  });

  describe('handleToggleAutosaveCommand', () => {
    beforeEach(() => {
      (clearAutosaveSettings as jest.Mock).mockImplementation(() => {});
    });

    it('should enable autosave when disabled', async () => {
      const channelId = '123456789';
      (toggleAutosave as jest.Mock).mockReturnValue(true);

      const mockInteraction = {
        channelId,
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'toggle-autosave'
      } as unknown as ChatInputCommandInteraction;

      await handleToggleAutosaveCommand(mockInteraction);

      expect(toggleAutosave).toHaveBeenCalledWith(channelId);
      expect(mockInteraction.reply).toHaveBeenCalledWith('✅ Autosave enabled for this channel.');
    });

    it('should disable autosave when enabled', async () => {
      const channelId = '123456789';
      (toggleAutosave as jest.Mock).mockReturnValue(false);

      const mockInteraction = {
        channelId,
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'toggle-autosave'
      } as unknown as ChatInputCommandInteraction;

      await handleToggleAutosaveCommand(mockInteraction);

      expect(toggleAutosave).toHaveBeenCalledWith(channelId);
      expect(mockInteraction.reply).toHaveBeenCalledWith('⛔ Autosave disabled for this channel.');
    });
  });

  describe('handleCheckAutosaveCommand', () => {
    it('should report autosave as enabled', async () => {
      const channelId = '123456789';
      (isAutosaveEnabled as jest.Mock).mockReturnValue(true);

      const mockInteraction = {
        channelId,
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'check-autosave'
      } as unknown as ChatInputCommandInteraction;

      await handleCheckAutosaveCommand(mockInteraction);

      expect(isAutosaveEnabled).toHaveBeenCalledWith(channelId);
      expect(mockInteraction.reply).toHaveBeenCalledWith('✅ Autosave is **enabled** for this channel.');
    });

    it('should report autosave as disabled', async () => {
      const channelId = '123456789';
      (isAutosaveEnabled as jest.Mock).mockReturnValue(false);

      const mockInteraction = {
        channelId,
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'check-autosave'
      } as unknown as ChatInputCommandInteraction;

      await handleCheckAutosaveCommand(mockInteraction);

      expect(isAutosaveEnabled).toHaveBeenCalledWith(channelId);
      expect(mockInteraction.reply).toHaveBeenCalledWith('⛔ Autosave is **disabled** for this channel.');
    });
  });

  describe('handleIngestAllCommand', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process channel history and save links', async () => {
      const mockMessage1 = {
        id: '111',
        channelId: '123456789',
        author: { id: '999', tag: 'User#1234', bot: false },
        content: 'Check out https://example.com',
        createdAt: new Date('2024-01-01T00:00:00Z')
      };

      const mockMessage2 = {
        id: '222',
        channelId: '123456789',
        author: { id: '888', tag: 'User#5678', bot: false },
        content: 'Also see http://test.com and https://another.com',
        createdAt: new Date('2024-01-01T01:00:00Z')
      };

      const mockMessages = new Map();
      mockMessages.set('111', mockMessage1);
      mockMessages.set('222', mockMessage2);

      const mockCollection = {
        size: 2,
        [Symbol.iterator]: function* () {
          for (const [key, value] of mockMessages) {
            yield [key, value];
          }
        },
        last: () => mockMessage2
      };

      const mockChannel = {
        id: '123456789',
        name: 'general',
        isTextBased: () => true,
        messages: {
          fetch: jest.fn()
            .mockResolvedValueOnce(mockCollection)
            .mockResolvedValueOnce({ size: 0 })
        }
      };

      (saveDiscordLinks as jest.Mock).mockResolvedValue({ data: [], error: null });

      const mockInteraction = {
        channel: mockChannel,
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'ingest-all'
      } as unknown as ChatInputCommandInteraction;

      await handleIngestAllCommand(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(saveDiscordLinks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://example.com',
            domain: 'example.com',
            message_id: '111'
          }),
          expect.objectContaining({
            url: 'http://test.com',
            domain: 'test.com',
            message_id: '222'
          }),
          expect.objectContaining({
            url: 'https://another.com',
            domain: 'another.com',
            message_id: '222'
          })
        ])
      );
      expect(mockInteraction.editReply).toHaveBeenLastCalledWith(
        expect.stringContaining('✅ Completed!')
      );
    });

    it('should handle channels with no links', async () => {
      const mockMessage = {
        id: '111',
        channelId: '123456789',
        author: { id: '999', tag: 'User#1234', bot: false },
        content: 'Just plain text without links',
        createdAt: new Date('2024-01-01T00:00:00Z')
      };

      const mockMessages = new Map();
      mockMessages.set('111', mockMessage);

      const mockCollection = {
        size: 1,
        [Symbol.iterator]: function* () {
          for (const [key, value] of mockMessages) {
            yield [key, value];
          }
        },
        last: () => mockMessage
      };

      const mockChannel = {
        id: '123456789',
        name: 'general',
        isTextBased: () => true,
        messages: {
          fetch: jest.fn()
            .mockResolvedValueOnce(mockCollection)
            .mockResolvedValueOnce({ size: 0 })
        }
      };

      const mockInteraction = {
        channel: mockChannel,
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'ingest-all'
      } as unknown as ChatInputCommandInteraction;

      await handleIngestAllCommand(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenLastCalledWith(
        expect.stringContaining('but found no links')
      );
      expect(saveDiscordLinks).not.toHaveBeenCalled();
    });

    it('should skip bot messages', async () => {
      const mockBotMessage = {
        id: '111',
        channelId: '123456789',
        author: { id: '999', tag: 'Bot#1234', bot: true },
        content: 'Bot message with https://example.com',
        createdAt: new Date('2024-01-01T00:00:00Z')
      };

      const mockMessages = new Map();
      mockMessages.set('111', mockBotMessage);

      const mockCollection = {
        size: 1,
        [Symbol.iterator]: function* () {
          for (const [key, value] of mockMessages) {
            yield [key, value];
          }
        },
        last: () => mockBotMessage
      };

      const mockChannel = {
        id: '123456789',
        name: 'general',
        isTextBased: () => true,
        messages: {
          fetch: jest.fn()
            .mockResolvedValueOnce(mockCollection)
            .mockResolvedValueOnce({ size: 0 })
        }
      };

      const mockInteraction = {
        channel: mockChannel,
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'ingest-all'
      } as unknown as ChatInputCommandInteraction;

      await handleIngestAllCommand(mockInteraction);

      expect(saveDiscordLinks).not.toHaveBeenCalled();
    });

    it('should reject non-text channels', async () => {
      const mockChannel = {
        isTextBased: () => false
      };

      const mockInteraction = {
        channel: mockChannel,
        reply: jest.fn().mockResolvedValue(undefined),
        user: { tag: 'TestUser#1234' },
        commandName: 'ingest-all'
      } as unknown as ChatInputCommandInteraction;

      await handleIngestAllCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        '❌ This command can only be used in text channels.'
      );
    });
  });
});
