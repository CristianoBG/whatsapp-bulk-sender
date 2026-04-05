import { FileRepository } from '../../infrastructure/storage/file-repository.js';
import { logger } from '../../infrastructure/logging/pino-logger.js';
import { env } from '../../config/env.js';

export interface PreviewItem {
  index: number;
  name: string;
  phone: string;
  message: string;
}

export class PreviewBulkUseCase {
  constructor(private fileRepository: FileRepository) {}

  async getPreviewItems(filePath: string, text: string): Promise<PreviewItem[]> {
    const report = await this.fileRepository.readContacts(filePath);
    return report.valid.map((contact, i) => ({
      index: i + 1,
      name: contact.name,
      phone: contact.phone,
      message: text.replace('{{name}}', contact.name),
    }));
  }

  async executeSimulation(items: PreviewItem[]): Promise<void> {
    if (items.length === 0) {
      logger.warn('No items to simulate');
      return;
    }

    logger.info(`🚀 Starting step-by-step simulation for ${items.length} contacts...`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      logger.info({ 
        index: item.index, 
        to: item.phone, 
        name: item.name,
        preview: item.message.substring(0, 50) + (item.message.length > 50 ? '...' : '')
      }, 'Simulated Delivery');

      if (i < items.length - 1) {
        const delay = Math.floor(Math.random() * (env.MAX_DELAY_SECONDS - env.MIN_DELAY_SECONDS + 1) + env.MIN_DELAY_SECONDS);
        logger.info({ delaySeconds: delay }, 'Waiting...');
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }
    }

    logger.info('✅ Simulation complete');
  }

  // Backward compatibility for CLI Commander
  async execute(filePath: string, text: string): Promise<void> {
    const items = await this.getPreviewItems(filePath, text);
    return this.executeSimulation(items);
  }
}
