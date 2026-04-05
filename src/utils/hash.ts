import crypto from 'node:crypto';

export function generateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateContactHash(phone: string, text: string): string {
  return generateHash(`${phone}:${text}`);
}
