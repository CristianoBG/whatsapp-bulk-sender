import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logging/pino-logger.js';

export interface Checkpoint {
  version: string;
  filePath: string;
  fileHash: string; // SHA-256 hash of the content
  lastIndex: number;
  total: number;
  updatedAt: string;
  processedHashes: string[]; // For idempotency (phone + message hash)
}

export class CheckpointRepository {
  private readonly checkpointDir = './.checkpoints';
  private readonly CURRENT_VERSION = '2.0.0';

  constructor() {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  save(checkpoint: Checkpoint): void {
    const fileName = this.getCheckpointFileName(checkpoint.filePath);
    const filePath = path.join(this.checkpointDir, fileName);
    
    checkpoint.version = this.CURRENT_VERSION;
    
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
    logger.debug({ index: checkpoint.lastIndex }, 'Checkpoint saved with integrity hash');
  }

  load(filePath: string): Checkpoint | null {
    const fileName = this.getCheckpointFileName(filePath);
    const checkpointPath = path.join(this.checkpointDir, fileName);

    if (!fs.existsSync(checkpointPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(checkpointPath, 'utf-8');
      return JSON.parse(data) as Checkpoint;
    } catch (error) {
      logger.error({ error }, 'Failed to load checkpoint');
      return null;
    }
  }

  isValidForFile(checkpoint: Checkpoint, currentHash: string): boolean {
    if (checkpoint.version !== this.CURRENT_VERSION) {
      logger.warn({ old: checkpoint.version, current: this.CURRENT_VERSION }, 'Checkpoint version mismatch');
      return false;
    }
    
    if (checkpoint.fileHash !== currentHash) {
      logger.error('❌ Checkpoint integrity check failed: file content has changed since the last run.');
      return false;
    }

    return true;
  }

  clear(filePath: string): void {
    const fileName = this.getCheckpointFileName(filePath);
    const checkpointPath = path.join(this.checkpointDir, fileName);

    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
      logger.info('Checkpoint cleared');
    }
  }

  private getCheckpointFileName(filePath: string): string {
    return Buffer.from(path.resolve(filePath)).toString('base64').replace(/\//g, '_') + '.json';
  }
}
