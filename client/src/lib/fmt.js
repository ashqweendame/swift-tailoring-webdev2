export const clean = (s) => String(s ?? '').replaceAll('_', ' ');
export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Dates arrive as "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
export function dateShort(s) {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
export function timeShort(s) {
  if (!s) return '';
  return new Date(String(s).replace(' ', 'T')).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
export const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const initials = (first, last) => `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
