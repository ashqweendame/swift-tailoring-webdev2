import crypto from 'node:crypto';
import { HttpError } from './http.js';

// Same format as the PHP version: TAI-XXXX-000 / ALT-XXXX-000
export async function generateOrderCode(conn, serviceType) {
  const prefix = serviceType === 'Tailoring' ? 'TAI' : 'ALT';
  for (let i = 0; i < 20; i++) {
    const middle = crypto.randomBytes(2).toString('hex').toUpperCase();
    const end = String(crypto.randomInt(0, 1000)).padStart(3, '0');
    const code = `${prefix}-${middle}-${end}`;
    const [rows] = await conn.query('SELECT 1 FROM orders WHERE order_code = ? LIMIT 1', [code]);
    if (rows.length === 0) return code;
  }
  throw new HttpError(500, 'Could not generate a unique order code.');
}
