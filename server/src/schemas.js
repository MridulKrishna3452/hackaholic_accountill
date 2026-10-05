import { z } from 'zod';

const trim = z.string().trim();
const email = trim.toLowerCase().email('Enter a valid email address').max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid date');
const cur = z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code');
const password = z.string().min(8, 'Use at least 8 characters').max(200);

export const signup = z.object({ name: trim.min(1, 'Enter your name').max(120), email, password });
export const signin = z.object({ email, password: z.string().min(1).max(200) });
export const forgot = z.object({ email });
export const reset = z.object({ token: z.string().min(10).max(200), password });
export const google = z.object({ credential: z.string().min(10) });

export const profile = z.object({
  name: trim.min(1).max(120),
  business_name: trim.max(160).default(''),
  phone: trim.max(60).default(''),
  address: trim.max(400).default(''),
  website: trim.max(200).default(''),
  payment_details: trim.max(1000).default(''),
  currency: cur.default('USD'),
  logo: z.string().max(400_000).regex(/^(data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+)?$/, 'Logo must be a PNG or JPEG').default(''),
});

export const client = z.object({
  name: trim.min(1, 'Enter a name').max(160),
  email: z.union([z.literal(''), email]).default(''),
  phone: trim.max(60).default(''),
  address: trim.max(400).default(''),
});

export const invoice = z.object({
  client_id: z.string().min(1, 'Choose a client'),
  currency: cur,
  issue_date: date,
  due_date: date,
  tax_percent: z.number().min(0).max(100),
  notes: trim.max(2000).default(''),
  items: z.array(z.object({
    description: trim.min(1, 'Describe each line item').max(500),
    quantity: z.number().positive('Quantity must be above 0').max(1_000_000),
    unit_price: z.number().min(0).max(100_000_000),
  })).min(1, 'Add at least one line item').max(100),
}).refine((v) => v.due_date >= v.issue_date, { path: ['due_date'], message: 'Due date cannot be before the issue date' });

export const payment = z.object({
  amount: z.number().positive('Amount must be above 0'),
  paid_on: date,
  method: trim.max(60).default(''),
  note: trim.max(300).default(''),
});
