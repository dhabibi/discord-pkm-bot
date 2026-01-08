import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { Client } from 'discord.js';
import { MCPWebhookPayload, MCPMessage } from './types';
import { verifyWebhookSignature } from './auth';

export class WebhookServer {
  private app: express.Application;
  private server: any;
  private discordClient: Client;
  private webhookSecret: string;

  constructor(discordClient: Client, webhookSecret: string) {
    this.app = express();
    this.discordClient = discordClient;
    this.webhookSecret = webhookSecret;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON with raw body for signature verification
    this.app.use(express.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString('utf8');
      }
    }));

    // Rate limiting for webhook endpoint
    const webhookLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // Limit each IP to 100 requests per minute
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    this.app.use('/webhook', webhookLimiter);

    // Logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[INFO] Webhook request: ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'discord-poke-connector' });
    });

    // Webhook endpoint for Poke messages
    this.app.post('/webhook/poke', async (req: Request, res: Response) => {
      try {
        // Verify signature
        const signature = req.headers['x-poke-signature'] as string;
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);
        
        if (!signature || !verifyWebhookSignature(rawBody, signature, this.webhookSecret)) {
          console.warn('[WARN] Invalid webhook signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }

        const payload: MCPWebhookPayload = req.body;

        // Process the webhook payload
        await this.handlePokeMessage(payload);

        res.json({ success: true });
      } catch (error) {
        console.error('[ERROR] Failed to process webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API info endpoint
    this.app.get('/api/info', (req: Request, res: Response) => {
      res.json({
        service: 'Discord-Poke MCP Connector',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          webhook: '/webhook/poke',
          info: '/api/info'
        }
      });
    });
  }

  private async handlePokeMessage(payload: MCPWebhookPayload): Promise<void> {
    console.log(`[INFO] Received Poke message event: ${payload.event}`);

    if (payload.event === 'message.received') {
      await this.forwardMessageToDiscord(payload.message);
    } else if (payload.event === 'message.deleted') {
      console.log('[INFO] Message deletion event received (not implemented)');
    } else if (payload.event === 'message.updated') {
      console.log('[INFO] Message update event received (not implemented)');
    }
  }

  private async forwardMessageToDiscord(message: MCPMessage): Promise<void> {
    try {
      // Get the target channel from context
      const channelId = message.context?.channelId;
      
      if (!channelId) {
        console.warn('[WARN] No channel ID in message context, cannot forward to Discord');
        return;
      }

      const channel = await this.discordClient.channels.fetch(channelId);
      
      if (!channel || !channel.isTextBased()) {
        console.warn(`[WARN] Invalid channel ${channelId} for message forwarding`);
        return;
      }

      // Check if the channel has a send method
      if (!('send' in channel)) {
        console.warn(`[WARN] Channel ${channelId} does not support sending messages`);
        return;
      }

      // Format the message for Discord
      const formattedMessage = `**[Poke → ${message.sender.name}]**: ${message.content}`;
      
      await channel.send(formattedMessage);
      console.log(`[INFO] Forwarded Poke message to Discord channel ${channelId}`);
    } catch (error) {
      console.error('[ERROR] Failed to forward message to Discord:', error);
    }
  }

  start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`[INFO] Webhook server listening on port ${port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[INFO] Webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): express.Application {
    return this.app;
  }
}
