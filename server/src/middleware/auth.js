import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError } from '../utils/http.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required.');

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new HttpError(401, 'Session expired. Please log in again.');
    }

    // Re-check the database so deactivated accounts and role changes apply immediately.
    const [rows] = await pool.query(
      'SELECT employee_id, firstname, lastname, role, employee_status FROM employee WHERE employee_id = ? LIMIT 1',
      [payload.id]
    );
    const emp = rows[0];
    if (!emp || emp.employee_status === 'Inactive') throw new HttpError(401, 'Account is no longer active.');

    req.user = { id: emp.employee_id, firstname: emp.firstname, lastname: emp.lastname, role: String(emp.role).trim().toLowerCase() };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have access to this resource.'));
