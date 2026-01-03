import { Message } from 'discord.js';
import { handleMessage } from './messageHandler';
import { isAutosaveEnabled } from './autosave';
import { saveLink } from './supabase';
import { extractUrls } from './urlExtractor';

// Mock dependencies
jest.mock('./autosave');
jest.mock('./supabase');
jest.mock('./urlExtractor');

describe('Message Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleMessage', () => {
    it('should ignore messages from bots', async () => {
      const mockMessage = {
        author: { bot: true },
        content: 'https://example.com',
        channelId: '123456789'
      } as unknown as Message;

      await handleMessage(mockMessage);

      expect(isAutosaveEnabled).not.toHaveBeenCalled();
      expect(extractUrls).not.toHaveBeenCalled();
      expect(saveLink).not.toHaveBeenCalled();
    });

    it('should ignore messages in channels without autosave enabled', async () => {
      (isAutosaveEnabled as jest.Mock).mockReturnValue(false);

      const mockMessage = {
        author: { bot: false },
        content: 'https://example.com',
        channelId: '123456789'
      } as unknown as Message;

      await handleMessage(mockMessage);

      expect(isAutosaveEnabled).toHaveBeenCalledWith('123456789');
      expect(extractUrls).not.toHaveBeenCalled();
      expect(saveLink).not.toHaveBeenCalled();
    });

    it('should save URLs from messages in channels with autosave enabled', async () => {
      (isAutosaveEnabled as jest.Mock).mockReturnValue(true);
      (extractUrls as jest.Mock).mockReturnValue(['https://example.com']);
      (saveLink as jest.Mock).mockResolvedValue({ data: { url: 'https://example.com' }, error: null });

      const mockMessage = {
        author: { bot: false },
        content: 'Check out https://example.com',
        channelId: '123456789'
      } as unknown as Message;

      await handleMessage(mockMessage);

      expect(isAutosaveEnabled).toHaveBeenCalledWith('123456789');
      expect(extractUrls).toHaveBeenCalledWith('Check out https://example.com');
      expect(saveLink).toHaveBeenCalledWith('https://example.com');
    });

    it('should save multiple URLs from a single message', async () => {
      (isAutosaveEnabled as jest.Mock).mockReturnValue(true);
      (extractUrls as jest.Mock).mockReturnValue(['https://example.com', 'http://test.com']);
      (saveLink as jest.Mock).mockResolvedValue({ data: {}, error: null });

      const mockMessage = {
        author: { bot: false },
        content: 'Check out https://example.com and http://test.com',
        channelId: '123456789'
      } as unknown as Message;

      await handleMessage(mockMessage);

      expect(saveLink).toHaveBeenCalledTimes(2);
      expect(saveLink).toHaveBeenNthCalledWith(1, 'https://example.com');
      expect(saveLink).toHaveBeenNthCalledWith(2, 'http://test.com');
    });

    it('should handle errors when saving URLs', async () => {
      (isAutosaveEnabled as jest.Mock).mockReturnValue(true);
      (extractUrls as jest.Mock).mockReturnValue(['https://example.com']);
      (saveLink as jest.Mock).mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockMessage = {
        author: { bot: false },
        content: 'Check out https://example.com',
        channelId: '123456789'
      } as unknown as Message;

      await handleMessage(mockMessage);

      expect(saveLink).toHaveBeenCalledWith('https://example.com');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle exceptions during save', async () => {
      (isAutosaveEnabled as jest.Mock).mockReturnValue(true);
      (extractUrls as jest.Mock).mockReturnValue(['https://example.com']);
      (saveLink as jest.Mock).mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockMessage = {
        author: { bot: false },
        content: 'Check out https://example.com',
        channelId: '123456789'
      } as unknown as Message;

      await handleMessage(mockMessage);

      expect(saveLink).toHaveBeenCalledWith('https://example.com');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should not call saveLink if no URLs found', async () => {
      (isAutosaveEnabled as jest.Mock).mockReturnValue(true);
      (extractUrls as jest.Mock).mockReturnValue([]);

      const mockMessage = {
        author: { bot: false },
        content: 'Just plain text',
        channelId: '123456789'
      } as unknown as Message;

      await handleMessage(mockMessage);

      expect(extractUrls).toHaveBeenCalledWith('Just plain text');
      expect(saveLink).not.toHaveBeenCalled();
    });
  });
});
