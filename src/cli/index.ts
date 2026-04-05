#!/usr/bin/env node
import { Command } from 'commander';
import { FileRepository } from '../infrastructure/storage/file-repository.js';
import { BaileysProvider } from '../infrastructure/whatsapp/baileys-provider.js';
import { CheckpointRepository } from '../infrastructure/storage/checkpoint-repository.js';
import { ReportRepository } from '../infrastructure/storage/report-repository.js';
import { ValidateContactsUseCase } from '../application/use-cases/validate-contacts.use-case.js';
import { PreviewBulkUseCase } from '../application/use-cases/preview-bulk.use-case.js';
import { BulkSendUseCase } from '../application/use-cases/bulk-send.use-case.js';
import { logger } from '../infrastructure/logging/pino-logger.js';
import { startMenu } from './menu.js';

const program = new Command();
const fileRepository = new FileRepository();
const messagingProvider = new BaileysProvider();
const checkpointRepository = new CheckpointRepository();
const reportRepository = new ReportRepository();

const controller = new AbortController();

async function runCli() {
  // If no arguments provided, launch the interactive menu
  if (process.argv.length <= 2) {
    try {
      await startMenu();
      return;
    } catch (error) {
      logger.error({ error }, 'Interactive menu error');
      process.exit(1);
    }
  }

  // Otherwise, use the Commander-based CLI
  program
    .name('whatsapp-bulk')
    .description('Professional WhatsApp Bulk Messaging CLI Tool (Production Grade)')
    .version('2.2.0');

  program
    .command('validate')
    .description('Validate contact list (CSV/JSON)')
    .argument('<file>', 'path to contact list file')
    .action(async (file) => {
      const useCase = new ValidateContactsUseCase(fileRepository);
      await useCase.execute(file);
    });

  program
    .command('preview')
    .description('Preview bulk sending without actual delivery (Dry Run)')
    .argument('<file>', 'path to contact list file')
    .requiredOption('-m, --message <text>', 'message content (use {{name}} for template)')
    .action(async (file, options) => {
      const useCase = new PreviewBulkUseCase(fileRepository);
      await useCase.execute(file, options.message);
    });

  program
    .command('send')
    .description('Execute bulk sending with Production Grade reliability')
    .argument('<file>', 'path to contact list file')
    .requiredOption('-m, --message <text>', 'message content (use {{name}} for template)')
    .option('--no-resume', 'do not resume from previous checkpoint')
    .action(async (file, options) => {
      process.on('SIGINT', () => controller.abort());
      process.on('SIGTERM', () => controller.abort());

      try {
        const useCase = new BulkSendUseCase(
          fileRepository, 
          messagingProvider, 
          checkpointRepository, 
          reportRepository
        );
        
        await useCase.execute(file, options.message, options.resume, controller.signal);
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Fatal error during bulk send');
        process.exit(1);
      }
    });

  program.parse(process.argv);
}

runCli().catch(err => {
  logger.error({ err }, 'Unhandled CLI error');
  process.exit(1);
});
