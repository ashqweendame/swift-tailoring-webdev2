import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError, ah, parse } from '../utils/http.js';
import { ROLES } from '../constants.js';

const router = Router();
router.use(requireAuth);

// Tailor dropdown for the service desk and admin order editor
router.get('/tailors', requireRole('service', 'admin'), ah(async (req, res) => {
  const [rows] = await pool.query("SELECT employee_id, firstname, lastname FROM employee WHERE role = 'Tailor' AND employee_status = 'Active' ORDER BY firstname, lastname");
  res.json(rows);
}));

router.use(requireRole('admin'));

const FIELDS = 'employee_id, firstname, lastname, role, email, phone, username, employee_status';

router.get('/', ah(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  const search = String(req.query.search || '').trim();
  const role = String(req.query.role || '');
  const status = String(req.query.status || '');

  if (search) {
    const like = `%${search}%`;
    const num = Number(search.replace(/^EMP-0*/i, ''));
    where.push(`(firstname LIKE ? OR lastname LIKE ? OR username LIKE ?${Number.isInteger(num) ? ' OR employee_id = ?' : ''})`);
    params.push(like, like, like);
    if (Number.isInteger(num)) params.push(num);
  }
  if (role) {
    if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role filter.');
    where.push('role = ?');
    params.push(role);
  }
  // Same default as before: only active staff unless searching or asking for everyone.
  if (status === 'Active' || status === 'Inactive') {
    where.push('employee_status = ?');
    params.push(status);
  } else if (!search && status !== 'all') {
    where.push("employee_status = 'Active'");
  }

  const [rows] = await pool.query(`SELECT ${FIELDS} FROM employee WHERE ${where.join(' AND ')} ORDER BY firstname, lastname`, params);
  res.json(rows);
}));

router.get('/:id', ah(async (req, res) => {
  const [rows] = await pool.query(`SELECT ${FIELDS} FROM employee WHERE employee_id = ?`, [Number(req.params.id) || 0]);
  if (!rows[0]) throw new HttpError(404, 'Employee not found.');
  res.json(rows[0]);
}));

const base = {
  firstname: z.string().trim().min(1).max(50),
  lastname: z.string().trim().min(1).max(50),
  role: z.enum(ROLES),
  email: z.string().trim().email().max(100),
  phone: z.string().trim().min(5).max(20),
};
const createSchema = z.object({
  ...base,
  username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_.-]+$/, 'Letters, numbers, dot, dash and underscore only.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72),
});
const updateSchema = z.object({
  ...base,
  status: z.enum(['Active', 'Inactive']),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72).optional().or(z.literal('')),
});

function duplicateError(err) {
  if (err.code !== 'ER_DUP_ENTRY') return err;
  const m = String(err.message);
  if (m.includes('email')) return new HttpError(409, 'Email address already exists.');
  if (m.includes('username')) return new HttpError(409, 'Username already exists.');
  return new HttpError(409, 'Duplicate entry found.');
}

router.post('/', ah(async (req, res) => {
  const d = parse(createSchema, req.body);
  const hash = await bcrypt.hash(d.password, 10);
  try {
    const [r] = await pool.query(
      'INSERT INTO employee (firstname, lastname, role, email, phone, username, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [d.firstname, d.lastname, d.role, d.email, d.phone, d.username, hash]
    );
    res.status(201).json({ employee_id: r.insertId, message: `[${d.role}] ${d.firstname} ${d.lastname} is added` });
  } catch (err) {
    throw duplicateError(err);
  }
}));

router.patch('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid employee id.');
  const d = parse(updateSchema, req.body);
  if (id === req.user.id && (d.status !== 'Active' || d.role.toLowerCase() !== 'admin')) {
    throw new HttpError(400, "You can't deactivate yourself or remove your own admin role.");
  }
  try {
    const [r] = await pool.query(
      'UPDATE employee SET firstname = ?, lastname = ?, role = ?, email = ?, phone = ?, employee_status = ? WHERE employee_id = ?',
      [d.firstname, d.lastname, d.role, d.email, d.phone, d.status, id]
    );
    if (r.affectedRows === 0) throw new HttpError(404, 'Employee not found.');
    if (d.password) {
      await pool.query('UPDATE employee SET password = ? WHERE employee_id = ?', [await bcrypt.hash(d.password, 10), id]);
    }
  } catch (err) {
    throw duplicateError(err);
  }
  const [rows] = await pool.query(`SELECT ${FIELDS} FROM employee WHERE employee_id = ?`, [id]);
  res.json(rows[0]);
}));

export default router;
