export function formatUsd(n: number) {
  if (!Number.isFinite(n)) return '$0.00';

  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
