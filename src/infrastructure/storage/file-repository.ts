import fs from 'node:fs';
import crypto from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { Contact, contactSchema, ValidationReport, ValidationError } from '../../domain/entities/contact.js';
import { logger } from '../logging/pino-logger.js';

export class FileRepository {
  async readContacts(filePath: string): Promise<ValidationReport> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let rawData: any[] = [];

    try {
      if (filePath.endsWith('.csv')) {
        rawData = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else if (filePath.endsWith('.json')) {
        rawData = JSON.parse(fileContent);
      } else {
        throw new Error('Unsupported file format. Please use .csv or .json');
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to parse file content');
      throw new Error(`Failed to parse ${filePath}: ${error.message}`);
    }

    return this.validateAndMap(rawData);
  }

  getFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found for hashing: ${filePath}`);
    }
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  private validateAndMap(data: any[]): ValidationReport {
    const valid: Contact[] = [];
    const invalid: ValidationError[] = [];

    for (const [index, item] of data.entries()) {
      const result = contactSchema.safeParse(item);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid.push({ 
          line: index + 1, 
          phone: item?.phone || 'N/A',
          errors: result.error.errors.map(e => e.message), 
          raw: item 
        });
      }
    }

    return { valid, invalid };
  }
}
