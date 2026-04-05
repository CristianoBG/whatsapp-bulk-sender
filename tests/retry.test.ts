import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/utils/retry.js';

describe('withRetry', () => {
  it('should succeed if operation succeeds on first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation, { maxRetries: 3, initialDelay: 0 });
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry and eventually succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');
    
    const result = await withRetry(operation, { maxRetries: 3, initialDelay: 0 });
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should throw if max retries reached', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('fail'));
    
    await expect(withRetry(operation, { maxRetries: 2, initialDelay: 0 }))
      .rejects.toThrow('fail');
    
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
