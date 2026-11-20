import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, ah, parse } from '../utils/http.js';

const router = Router();
const ROLES = ['admin', 'service', 'tailor'];

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

router.post('/login', loginLimiter, ah(async (req, res) => {
  const { username, password } = parse(loginSchema, req.body);
  const [rows] = await pool.query('SELECT * FROM employee WHERE username = ? LIMIT 1', [username]);
  const emp = rows[0];

  // PHP's password_hash() writes $2y$ hashes; $2b$ is the same algorithm.
  const hash = emp ? String(emp.password).replace(/^\$2y\$/, '$2b$') : '';
  const ok = emp && (await bcrypt.compare(password, hash));
  if (!ok) throw new HttpError(401, 'Invalid credentials. Please try again.');
  if (emp.employee_status === 'Inactive') throw new HttpError(403, 'This account is inactive. Contact an administrator.');

  const role = String(emp.role).trim().toLowerCase();
  if (!ROLES.includes(role)) throw new HttpError(403, 'Your account role is not configured.');

  const user = { id: emp.employee_id, firstname: emp.firstname, lastname: emp.lastname, role };
  const token = jwt.sign(user, config.jwtSecret, { expiresIn: '8h' });
  res.json({ token, user });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
