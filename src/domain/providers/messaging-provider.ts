export interface Message {
  id?: string;
  to: string;
  text: string;
  timestamp?: number;
}

export interface MessagingProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(message: Message): Promise<void>;
  isConnected(): boolean;
  on(event: 'connection.update', listener: (status: 'open' | 'connecting' | 'close') => void): void;
  on(event: 'qr', listener: (qr: string) => void): void;
}
