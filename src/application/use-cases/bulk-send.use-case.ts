import { FileRepository } from '../../infrastructure/storage/file-repository.js';
import { MessagingProvider } from '../../domain/providers/messaging-provider.js';
import { CheckpointRepository, Checkpoint } from '../../infrastructure/storage/checkpoint-repository.js';
import { ReportRepository, ReportItem } from '../../infrastructure/storage/report-repository.js';
import { MessagingError, MessagingErrorCode } from '../../domain/errors/messaging-error.js';
import { withRetry } from '../../utils/retry.js';
import { generateContactHash } from '../../utils/hash.js';
import { logger } from '../../infrastructure/logging/pino-logger.js';
import { env } from '../../config/env.js';

export class BulkSendUseCase {
  private aborted = false;

  constructor(
    private fileRepository: FileRepository,
    private messagingProvider: MessagingProvider,
    private checkpointRepository: CheckpointRepository,
    private reportRepository: ReportRepository
  ) {}

  async execute(filePath: string, text: string, resume: boolean = true, signal?: AbortSignal): Promise<void> {
    const currentFileHash = this.fileRepository.getFileHash(filePath);
    const report = await this.fileRepository.readContacts(filePath);
    const contacts = report.valid;
    
    if (contacts.length === 0) {
      logger.warn('No valid contacts found to send messages');
      return;
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        logger.warn('⚠️ Abort signal received. Closing bulk send gracefully...');
        this.aborted = true;
      });
    }

    let startIndex = 0;
    let processedHashes: string[] = [];
    const checkpoint = this.checkpointRepository.load(filePath);
    
    if (resume && checkpoint) {
      if (this.checkpointRepository.isValidForFile(checkpoint, currentFileHash)) {
        startIndex = checkpoint.lastIndex + 1;
        processedHashes = checkpoint.processedHashes || [];
        logger.info({ startIndex, total: contacts.length }, '🔁 Resuming from previous checkpoint');
      } else {
        logger.warn('⚠️ Resuming was skipped due to file content change. Starting from scratch.');
      }
    }

    if (!this.messagingProvider.isConnected()) {
      logger.info('Connecting to WhatsApp...');
      await this.messagingProvider.connect();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 60000);
        this.messagingProvider.on('connection.update', (status) => {
          if (status === 'open') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    const reportItems: ReportItem[] = [];
    logger.info({ startAt: startIndex, count: contacts.length - startIndex }, '🚀 Starting production-grade bulk send');
    
    for (let i = startIndex; i < contacts.length; i++) {
      if (this.aborted) {
        logger.info('🛑 Bulk send stopped by user/system signal');
        break;
      }

      const contact = contacts[i];
      const messageText = text.replace('{{name}}', contact.name);
      const contactHash = generateContactHash(contact.phone, messageText);
      
      if (processedHashes.includes(contactHash)) {
        logger.debug({ phone: contact.phone }, 'Skipping already processed contact (Idempotency)');
        continue;
      }

      let attempts = 0;
      
      try {
        await withRetry(
          async () => {
            attempts++;
            await this.messagingProvider.sendMessage({
              to: contact.phone,
              text: messageText,
            });
          },
          { maxRetries: env.MAX_RETRIES, initialDelay: env.RETRY_INITIAL_DELAY_MS },
          (error) => {
            const classifiedError = MessagingError.fromBaileysError(error);
            if (classifiedError.isPermanent()) {
              logger.debug({ to: contact.phone, code: classifiedError.code }, 'Skipping retries for permanent error');
              throw classifiedError;
            }
            logger.warn({ to: contact.phone, attempt: attempts, error: error.message }, 'Retryable delivery attempt');
          }
        );
        
        processedHashes.push(contactHash);
        reportItems.push({
          name: contact.name,
          phone: contact.phone,
          status: 'success',
          timestamp: new Date().toISOString(),
          attempts,
        });

        logger.info({ index: i + 1, total: contacts.length, to: contact.phone, attempts }, '✓ Sent');

      } catch (error: any) {
        const classifiedError = error instanceof MessagingError ? error : MessagingError.fromBaileysError(error);
        
        reportItems.push({
          name: contact.name,
          phone: contact.phone,
          status: 'failed',
          error: classifiedError.message,
          errorCode: classifiedError.code,
          timestamp: new Date().toISOString(),
          attempts,
        });

        logger.error({ 
          index: i + 1, 
          to: contact.phone, 
          error: classifiedError.message,
          code: classifiedError.code,
          attempts
        }, '✗ Final Failure');

        if (classifiedError.code === MessagingErrorCode.ACCOUNT_BANNED) {
          logger.error('❌ CRITICAL: Account session closed. Stopping execution.');
          break;
        }
      }

      this.checkpointRepository.save({
        version: '2.0.0',
        filePath,
        fileHash: currentFileHash,
        lastIndex: i,
        total: contacts.length,
        updatedAt: new Date().toISOString(),
        processedHashes
      });

      if (i < contacts.length - 1) {
        const delayInSeconds = Math.floor(
          Math.random() * (env.MAX_DELAY_SECONDS - env.MIN_DELAY_SECONDS + 1) + env.MIN_DELAY_SECONDS
        );
        
        logger.info({ delaySeconds: delayInSeconds }, 'Jitter delay...');
        await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
      }
    }

    this.reportRepository.generate(filePath, reportItems);
    
    if (!this.aborted && reportItems.length > 0) {
      this.checkpointRepository.clear(filePath);
      logger.info('🎉 Campaign complete. Checkpoint cleared.');
    } else {
      logger.info('💾 Process stopped. Checkpoint maintained for future resume.');
    }
  }
}
