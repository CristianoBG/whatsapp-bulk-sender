import fs from 'node:fs';
import { logger } from '../logging/pino-logger.js';

export interface AppSettings {
  lastFilePath?: string;
  updatedAt: string;
}

export class SettingsRepository {
  private readonly settingsPath = './.settings.json';

  save(settings: Partial<AppSettings>): void {
    const current = this.load();
    const updated = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(this.settingsPath, JSON.stringify(updated, null, 2));
    logger.debug('App settings saved');
  }

  load(): AppSettings {
    if (!fs.existsSync(this.settingsPath)) {
      return { updatedAt: new Date().toISOString() };
    }

    try {
      const data = fs.readFileSync(this.settingsPath, 'utf-8');
      return JSON.parse(data) as AppSettings;
    } catch (error) {
      logger.error({ error }, 'Failed to load app settings');
      return { updatedAt: new Date().toISOString() };
    }
  }
}
