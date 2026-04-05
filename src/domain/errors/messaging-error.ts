export enum MessagingErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_NUMBER = 'INVALID_NUMBER',
  BLOCKED = 'BLOCKED',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export class MessagingError extends Error {
  constructor(
    public readonly code: MessagingErrorCode,
    message: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'MessagingError';
  }

  isRetryable(): boolean {
    return [
      MessagingErrorCode.NETWORK_ERROR,
      MessagingErrorCode.TIMEOUT,
      MessagingErrorCode.UNKNOWN
    ].includes(this.code);
  }

  isPermanent(): boolean {
    return [
      MessagingErrorCode.INVALID_NUMBER,
      MessagingErrorCode.ACCOUNT_BANNED,
      MessagingErrorCode.BLOCKED
    ].includes(this.code);
  }

  static fromBaileysError(error: any): MessagingError {
    const message = error.message || 'Unknown WhatsApp Error';
    
    if (message.includes('not on WhatsApp')) {
      return new MessagingError(MessagingErrorCode.INVALID_NUMBER, 'Number is not on WhatsApp', error);
    }
    
    if (message.includes('Connection closed') || message.includes('ECONNRESET') || message.includes('TIMEDOUT')) {
      return new MessagingError(MessagingErrorCode.NETWORK_ERROR, 'Connection issue', error);
    }

    if (message.includes('logged out') || message.includes('401')) {
      return new MessagingError(MessagingErrorCode.ACCOUNT_BANNED, 'Session closed or Account Banned', error);
    }

    return new MessagingError(MessagingErrorCode.UNKNOWN, message, error);
  }
}
