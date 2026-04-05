import { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  WASocket,
  ConnectionState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { MessagingProvider, Message } from '../../domain/providers/messaging-provider.js';
import { logger } from '../logging/pino-logger.js';
import { env } from '../../config/env.js';

export class BaileysProvider implements MessagingProvider {
  private sock: WASocket | null = null;
  private status: 'open' | 'connecting' | 'close' = 'close';
  private eventHandlers: Map<string, Array<(...args: any[]) => void>> = new Map();

  async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${env.SESSION_NAME}`);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    logger.info({ version, isLatest }, 'Starting Baileys connection');

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // Handle manually
      logger: logger as any,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('Scan this QR code to connect:');
        qrcode.generate(qr, { small: true });
        this.emit('qr', qr);
      }

      if (connection === 'connecting') {
        this.status = 'connecting';
        this.emit('connection.update', 'connecting');
      }

      if (connection === 'open') {
        this.status = 'open';
        logger.info('✅ WhatsApp connection opened successfully');
        this.emit('connection.update', 'open');
      }

      if (connection === 'close') {
        this.status = 'close';
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        logger.warn({ error: lastDisconnect?.error }, 'Connection closed');
        this.emit('connection.update', 'close');

        if (shouldReconnect) {
          logger.info('Attempting to reconnect...');
          this.connect();
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
    }
  }

  async sendMessage(message: Message): Promise<void> {
    if (!this.sock || this.status !== 'open') {
      throw new Error('Cannot send message: WhatsApp connection not open');
    }

    const jid = message.to.includes('@s.whatsapp.net') ? message.to : `${message.to}@s.whatsapp.net`;
    
    try {
      await this.sock.sendMessage(jid, { text: message.text });
      logger.debug({ to: jid }, 'Message sent successfully');
    } catch (error) {
      logger.error({ error, to: jid }, 'Failed to send message');
      throw error;
    }
  }

  isConnected(): boolean {
    return this.status === 'open';
  }

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(listener);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }
}
