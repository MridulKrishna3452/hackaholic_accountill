// All money is integer minor units (cents). Quantities are integer thousandths.
export const lineTotal = (it) => Math.round((it.quantity_milli * it.unit_cents) / 1000);

export function totals(items, taxBps, paidCents = 0) {
  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const tax = Math.round((subtotal * taxBps) / 10000);
  const total = subtotal + tax;
  return { subtotal, tax, total, paid: paidCents, balance: total - paidCents };
}

export function statusOf({ total, paid }, dueDate, today = new Date().toISOString().slice(0, 10)) {
  if (total > 0 && paid >= total) return 'paid';
  if (dueDate < today) return 'overdue';
  return paid > 0 ? 'partial' : 'unpaid';
}
