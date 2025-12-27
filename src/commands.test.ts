import { handlePingCommand, commands } from './commands';
import { ChatInputCommandInteraction } from 'discord.js';

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
