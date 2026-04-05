import { describe, it, expect, vi } from 'vitest';
import { FileRepository } from '../src/infrastructure/storage/file-repository.js';
import fs from 'node:fs';

vi.mock('node:fs');

describe('FileRepository', () => {
  it('should parse a valid CSV file', async () => {
    const filePath = 'test.csv';
    const csvContent = 'name,phone\nJohn,5511999999999\n';
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(csvContent);

    const repo = new FileRepository();
    const contacts = await repo.readContacts(filePath);

    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('John');
    expect(contacts[0].phone).toBe('5511999999999');
  });

  it('should parse a valid JSON file', async () => {
    const filePath = 'test.json';
    const jsonContent = '[{"name": "Alice", "phone": "5511888888888"}]';
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(jsonContent);

    const repo = new FileRepository();
    const contacts = await repo.readContacts(filePath);

    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('Alice');
  });

  it('should throw for unsupported format', async () => {
    const repo = new FileRepository();
    await expect(repo.readContacts('test.txt')).rejects.toThrow('Unsupported file format');
  });
});
