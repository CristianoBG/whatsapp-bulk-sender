import { logger } from '../infrastructure/logging/pino-logger.js';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  onRetry?: (error: any, attempt: number) => void
): Promise<T> {
  let attempt = 0;
  
  while (attempt <= options.maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      if (attempt > options.maxRetries) {
        throw error;
      }

      const delay = options.initialDelay * Math.pow(2, attempt - 1);
      logger.warn({ attempt, nextDelay: delay, error: error instanceof Error ? error.message : error }, 'Retrying failed operation (Exponential Backoff)');
      
      if (onRetry) {
        onRetry(error, attempt);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries reached');
}
