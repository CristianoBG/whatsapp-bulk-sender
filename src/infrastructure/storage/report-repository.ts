import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logging/pino-logger.js';

export interface ReportItem {
  name: string;
  phone: string;
  status: 'success' | 'failed';
  error?: string;
  errorCode?: string;
  timestamp: string;
  attempts: number;
}

export class ReportRepository {
  private readonly reportsDir = './reports';

  constructor() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  generate(filePath: string, items: ReportItem[]): void {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const baseDir = path.join(this.reportsDir, timestamp);
    
    fs.mkdirSync(baseDir, { recursive: true });

    const success = items.filter(i => i.status === 'success');
    const failed = items.filter(i => i.status === 'failed');

    fs.writeFileSync(path.join(baseDir, 'success.json'), JSON.stringify(success, null, 2));
    fs.writeFileSync(path.join(baseDir, 'failed.json'), JSON.stringify(failed, null, 2));
    fs.writeFileSync(path.join(baseDir, 'full_report.json'), JSON.stringify(items, null, 2));

    logger.info({ 
      dir: baseDir, 
      success: success.length, 
      failed: failed.length 
    }, '📊 Reports generated');
  }
}
