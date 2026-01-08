import { Message, User, TextChannel, Attachment, Collection } from 'discord.js';
import { discordToMCPMessage, shouldForwardToPoke } from './discordForwarder';

describe('Discord Forwarder', () => {
  describe('discordToMCPMessage', () => {
    it('should convert basic Discord message to MCP format', () => {
      const mockMessage = {
        id: 'msg_123',
        content: 'Hello, world!',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        author: {
          id: 'user_123',
          username: 'TestUser',
          bot: false
        },
        channelId: 'channel_123',
        channel: {
          isThread: () => false
        },
        attachments: new Collection<string, Attachment>(),
        embeds: [],
        mentions: {
          users: new Collection<string, User>()
        },
        reference: null
      } as unknown as Message;

      const mcpMessage = discordToMCPMessage(mockMessage);

      expect(mcpMessage).toMatchObject({
        id: 'msg_123',
        type: 'text',
        content: 'Hello, world!',
        timestamp: '2024-01-01T12:00:00.000Z',
        sender: {
          id: 'user_123',
          name: 'TestUser',
          platform: 'discord'
        },
        context: {
          channelId: 'channel_123'
        }
      });
    });

    it('should mark message as media type when attachments exist', () => {
      const mockAttachment = {
        url: 'https://example.com/image.png',
        name: 'image.png',
        contentType: 'image/png'
      } as Attachment;

      const attachments = new Collection<string, Attachment>();
      attachments.set('att_1', mockAttachment);

      const mockMessage = {
        id: 'msg_123',
        content: 'Check this out!',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        author: {
          id: 'user_123',
          username: 'TestUser',
          bot: false
        },
        channelId: 'channel_123',
        channel: {
          isThread: () => false
        },
        attachments,
        embeds: [],
        mentions: {
          users: new Collection<string, User>()
        },
        reference: null
      } as unknown as Message;

      const mcpMessage = discordToMCPMessage(mockMessage);

      expect(mcpMessage.type).toBe('media');
      expect(mcpMessage.metadata?.attachments).toHaveLength(1);
      expect(mcpMessage.metadata?.attachments[0]).toMatchObject({
        url: 'https://example.com/image.png',
        name: 'image.png',
        contentType: 'image/png'
      });
    });

    it('should include thread context when in thread', () => {
      const mockMessage = {
        id: 'msg_123',
        content: 'Thread message',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        author: {
          id: 'user_123',
          username: 'TestUser',
          bot: false
        },
        channelId: 'thread_123',
        channel: {
          isThread: () => true,
          id: 'thread_123'
        },
        attachments: new Collection<string, Attachment>(),
        embeds: [],
        mentions: {
          users: new Collection<string, User>()
        },
        reference: null
      } as unknown as Message;

      const mcpMessage = discordToMCPMessage(mockMessage);

      expect(mcpMessage.context?.threadId).toBe('thread_123');
    });

    it('should include reply reference when replying', () => {
      const mockMessage = {
        id: 'msg_123',
        content: 'Reply message',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        author: {
          id: 'user_123',
          username: 'TestUser',
          bot: false
        },
        channelId: 'channel_123',
        channel: {
          isThread: () => false
        },
        attachments: new Collection<string, Attachment>(),
        embeds: [],
        mentions: {
          users: new Collection<string, User>()
        },
        reference: {
          messageId: 'msg_parent_123'
        }
      } as unknown as Message;

      const mcpMessage = discordToMCPMessage(mockMessage);

      expect(mcpMessage.context?.replyToId).toBe('msg_parent_123');
    });
  });

  describe('shouldForwardToPoke', () => {
    it('should forward regular user messages', () => {
      const mockMessage = {
        author: { bot: false },
        system: false,
        content: 'Hello',
        attachments: new Collection<string, Attachment>()
      } as Message;

      expect(shouldForwardToPoke(mockMessage)).toBe(true);
    });

    it('should not forward bot messages', () => {
      const mockMessage = {
        author: { bot: true },
        system: false,
        content: 'Bot message',
        attachments: new Collection<string, Attachment>()
      } as Message;

      expect(shouldForwardToPoke(mockMessage)).toBe(false);
    });

    it('should not forward system messages', () => {
      const mockMessage = {
        author: { bot: false },
        system: true,
        content: 'System message',
        attachments: new Collection<string, Attachment>()
      } as Message;

      expect(shouldForwardToPoke(mockMessage)).toBe(false);
    });

    it('should not forward empty messages without attachments', () => {
      const mockMessage = {
        author: { bot: false },
        system: false,
        content: '',
        attachments: new Collection<string, Attachment>()
      } as Message;

      expect(shouldForwardToPoke(mockMessage)).toBe(false);
    });

    it('should forward messages with only attachments', () => {
      const mockAttachment = {
        url: 'https://example.com/image.png',
        name: 'image.png'
      } as Attachment;

      const attachments = new Collection<string, Attachment>();
      attachments.set('att_1', mockAttachment);

      const mockMessage = {
        author: { bot: false },
        system: false,
        content: '',
        attachments
      } as Message;

      expect(shouldForwardToPoke(mockMessage)).toBe(true);
    });
  });
});
