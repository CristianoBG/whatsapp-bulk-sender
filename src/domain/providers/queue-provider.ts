export interface QueueJob<T> {
  id: string;
  data: T;
  status: 'pending' | 'active' | 'completed' | 'failed';
  attempts: number;
}

export interface QueueProvider<T> {
  add(data: T): Promise<QueueJob<T>>;
  process(worker: (data: T) => Promise<void>): void;
  getStats(): Promise<{ pending: number; completed: number; failed: number }>;
}
