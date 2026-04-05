import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^\d{10,15}$/, 'Invalid phone format (DDI+DDD+Number)'),
});

export type Contact = z.infer<typeof contactSchema>;

export interface ValidationError {
  line: number;
  phone?: string;
  errors: string[];
  raw?: any;
}

export interface ValidationReport {
  valid: Contact[];
  invalid: ValidationError[];
}
