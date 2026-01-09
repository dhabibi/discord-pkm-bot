import { handlePingCommand, handleSaveCommand, handleToggleAutosaveCommand, handleCheckAutosaveCommand, handleCommand, commands } from './commands';
import { ChatInputCommandInteraction } from 'discord.js';
import { saveLink } from './supabase';
import { toggleAutosave, isAutosaveEnabled, clearAutosaveSettings } from './autosave';
import { isAuthorized, logUnauthorizedAccess, getUnauthorizedMessage } from './authorization';

// Mock dependencies
jest.mock('./supabase');
jest.mock('./autosave');
jest.mock('./authorization');

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

  describe('handleCommand with Authorization', () => {
    beforeEach(() => {
      (clearAutosaveSettings as jest.Mock).mockImplementation(() => {});
    });

    it('should allow authorized user to execute command', async () => {
      const mockUserId = '123456789';
      const mockUserTag = 'AuthorizedUser#1234';
      (isAuthorized as jest.Mock).mockReturnValue(true);

      const mockInteraction = {
        user: { id: mockUserId, tag: mockUserTag },
        commandName: 'ping',
        reply: jest.fn().mockResolvedValue(undefined)
      } as unknown as ChatInputCommandInteraction;

      await handleCommand(mockInteraction);

      expect(isAuthorized).toHaveBeenCalledWith(mockUserId);
      expect(mockInteraction.reply).toHaveBeenCalledWith('Pong! 🏓');
      expect(logUnauthorizedAccess).not.toHaveBeenCalled();
    });

    it('should block unauthorized user from executing command', async () => {
      const mockUserId = '987654321';
      const mockUserTag = 'UnauthorizedUser#5678';
      const mockMessage = '🔒 You are not authorized to use this bot. If you believe this is an error, please contact the bot administrator.';
      
      (isAuthorized as jest.Mock).mockReturnValue(false);
      (logUnauthorizedAccess as jest.Mock).mockImplementation(() => {});
      (getUnauthorizedMessage as jest.Mock).mockReturnValue(mockMessage);

      const mockInteraction = {
        user: { id: mockUserId, tag: mockUserTag },
        commandName: 'save',
        reply: jest.fn().mockResolvedValue(undefined)
      } as unknown as ChatInputCommandInteraction;

      await handleCommand(mockInteraction);

      expect(isAuthorized).toHaveBeenCalledWith(mockUserId);
      expect(logUnauthorizedAccess).toHaveBeenCalledWith(mockUserId, mockUserTag, 'save');
      expect(mockInteraction.reply).toHaveBeenCalledWith({ content: mockMessage, ephemeral: true });
    });

    it('should log unauthorized access attempts', async () => {
      const mockUserId = '111222333';
      const mockUserTag = 'Hacker#9999';
      
      (isAuthorized as jest.Mock).mockReturnValue(false);
      (logUnauthorizedAccess as jest.Mock).mockImplementation(() => {});
      (getUnauthorizedMessage as jest.Mock).mockReturnValue('Not authorized');

      const mockInteraction = {
        user: { id: mockUserId, tag: mockUserTag },
        commandName: 'toggle-autosave',
        reply: jest.fn().mockResolvedValue(undefined)
      } as unknown as ChatInputCommandInteraction;

      await handleCommand(mockInteraction);

      expect(logUnauthorizedAccess).toHaveBeenCalledWith(mockUserId, mockUserTag, 'toggle-autosave');
    });

    it('should handle reply errors gracefully when unauthorized', async () => {
      const mockUserId = '999888777';
      const mockUserTag = 'TestUser#0000';
      
      (isAuthorized as jest.Mock).mockReturnValue(false);
      (logUnauthorizedAccess as jest.Mock).mockImplementation(() => {});
      (getUnauthorizedMessage as jest.Mock).mockReturnValue('Not authorized');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockInteraction = {
        user: { id: mockUserId, tag: mockUserTag },
        commandName: 'ping',
        reply: jest.fn().mockRejectedValue(new Error('Reply failed'))
      } as unknown as ChatInputCommandInteraction;

      await handleCommand(mockInteraction);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ERROR] Failed to send unauthorized message to user:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
