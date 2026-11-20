import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError, ah, parse } from '../utils/http.js';
import { generateOrderCode } from '../utils/orderCode.js';
import { sendReadyNotification } from '../utils/notifications.js';
import { STATUSES, TAILOR_TRANSITIONS, SERVICE_TRANSITIONS, GARMENT_COMPONENTS, SUIT_GARMENTS, COLORS, PATTERNS, MATERIALS } from '../constants.js';

const router = Router();

const trackLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookups. Please wait a minute and try again.' },
});

const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (n) => Math.round(n * 100) / 100;
const isOverdue = (status, due) => ['Pending', 'Assigned', 'Ready'].includes(status) && String(due) < todayLocal();
const notifyChanged = (req, code) => req.app.get('io')?.to(`order:${code}`).emit('order:changed', { order_code: code });

/* ------------------------------------------------------------------ */
/* PUBLIC: customer tracking (replaces customer/index.php)             */
/* ------------------------------------------------------------------ */
router.get('/track/:code', trackLimiter, ah(async (req, res) => {
  const code = String(req.params.code || '').trim();
  const notFound = new HttpError(404, 'Invalid tracking code or order not found.');
  if (!code || code.length > 32) throw notFound;

  const [rows] = await pool.query(
    `SELECT o.order_id, o.order_code, o.order_status, o.est_pickup_date,
            c.firstname AS cust_first, c.lastname AS cust_last,
            e.firstname AS emp_first, e.lastname AS emp_last,
            g.suit_type, g.garment_type, g.garment_component,
            od.measurement_value, od.service_type, od.order_price,
            f.fabric_color, f.fabric_pattern, f.fabric_material
     FROM orders o
     JOIN order_details od ON o.order_id = od.order_id
     JOIN customer c ON od.customer_id = c.customer_id
     JOIN employee e ON od.employee_id = e.employee_id
     JOIN garment g ON od.garment_id = g.garment_id
     JOIN fabric f ON g.fabric_id = f.fabric_id
     WHERE o.order_code = ?
     ORDER BY od.order_details_id`,
    [code]
  );
  if (rows.length === 0) throw notFound;

  const first = rows[0];
  const groups = new Map();
  for (const r of rows) {
    let g = groups.get(r.garment_type);
    if (!g) {
      g = {
        garment_type: r.garment_type,
        price: 0,
        fabric: r.service_type === 'Tailoring' ? { color: r.fabric_color, pattern: r.fabric_pattern, material: r.fabric_material } : null,
        components: [],
      };
      groups.set(r.garment_type, g);
    }
    g.price += Number(r.order_price);
    g.components.push({ component: r.garment_component, measurement: r.measurement_value });
  }
  const garments = [...groups.values()].map((g) => ({ ...g, price: money(g.price) }));

  res.json({
    order_code: first.order_code,
    status: first.order_status,
    due_date: first.est_pickup_date,
    service_type: first.service_type,
    suit_type: first.suit_type,
    customer: { firstname: first.cust_first, lastname: first.cust_last },
    tailor: `${first.emp_first} ${first.emp_last}`,
    garments,
    total: money(garments.reduce((s, g) => s + g.price, 0)),
  });
}));

/* Everything below requires a valid JWT */
router.use(requireAuth);

/* ------------------------------------------------------------------ */
/* Create order (service desk) — replaces service/process_order.php    */
/* ------------------------------------------------------------------ */
const itemSchema = z.object({
  garment_type: z.enum(['Jacket', 'Trouser']),
  component: z.string(),
  measurement: z.string().trim().min(1).max(100),
  price: z.number().min(0).max(1_000_000),
});

const createSchema = z.object({
  firstname: z.string().trim().min(1).max(50),
  lastname: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(100),
  phone: z.string().regex(/^09\d{9}$/, 'Enter an 11-digit Philippine mobile number (09XXXXXXXXX).'),
  service_type: z.enum(['Alteration', 'Tailoring']),
  suit_type: z.enum(Object.keys(SUIT_GARMENTS)),
  est_pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.'),
  employee_id: z.number().int().positive(),
  fabric_color: z.enum(COLORS).optional(),
  fabric_pattern: z.enum(PATTERNS).optional(),
  fabric_material: z.enum(MATERIALS).optional(),
  items: z.array(itemSchema).min(1).max(30),
});

router.post('/', requireRole('service', 'admin'), ah(async (req, res) => {
  const d = parse(createSchema, req.body);

  if (Number.isNaN(Date.parse(d.est_pickup_date)) || d.est_pickup_date < todayLocal()) {
    throw new HttpError(400, 'Estimated pick-up date must be today or later.');
  }
  if (d.service_type === 'Tailoring' && !(d.fabric_color && d.fabric_pattern && d.fabric_material)) {
    throw new HttpError(400, 'Fabric color, pattern and material are required for tailoring orders.');
  }

  const allowedGarments = SUIT_GARMENTS[d.suit_type];
  const seen = new Set();
  for (const it of d.items) {
    if (!allowedGarments.includes(it.garment_type)) throw new HttpError(400, `${it.garment_type} is not part of a ${d.suit_type.replace('_', ' ')}.`);
    if (!GARMENT_COMPONENTS[it.garment_type].includes(it.component)) throw new HttpError(400, `Unknown component: ${it.component}.`);
    const key = `${it.garment_type}:${it.component}`;
    if (seen.has(key)) throw new HttpError(400, `Duplicate component: ${it.component}.`);
    seen.add(key);
  }

  const result = await withTransaction(async (conn) => {
    const [tailor] = await conn.query("SELECT 1 FROM employee WHERE employee_id = ? AND role = 'Tailor' AND employee_status = 'Active'", [d.employee_id]);
    if (tailor.length === 0) throw new HttpError(400, 'The selected tailor is not available.');

    const [existing] = await conn.query(
      'SELECT customer_id FROM customer WHERE firstname = ? AND lastname = ? AND email = ? AND phone = ? LIMIT 1',
      [d.firstname, d.lastname, d.email, d.phone]
    );
    let customerId;
    if (existing.length) {
      customerId = existing[0].customer_id;
    } else {
      const [ins] = await conn.query('INSERT INTO customer (firstname, lastname, email, phone) VALUES (?, ?, ?, ?)', [d.firstname, d.lastname, d.email, d.phone]);
      customerId = ins.insertId;
    }

    let fabricId = 1; // shared placeholder row used by alterations, same as before
    if (d.service_type === 'Tailoring') {
      const [f] = await conn.query('INSERT INTO fabric (fabric_pattern, fabric_material, fabric_color) VALUES (?, ?, ?)', [d.fabric_pattern, d.fabric_material, d.fabric_color]);
      fabricId = f.insertId;
    }

    const code = await generateOrderCode(conn, d.service_type);
    const total = money(d.items.reduce((s, i) => s + i.price, 0)); // computed server-side
    const [o] = await conn.query('INSERT INTO orders (order_code, order_status, total_amount, est_pickup_date) VALUES (?, ?, ?, ?)', [code, 'Assigned', total, d.est_pickup_date]);

    for (const it of d.items) {
      const [g] = await conn.query('INSERT INTO garment (fabric_id, suit_type, garment_type, garment_component) VALUES (?, ?, ?, ?)', [fabricId, d.suit_type, it.garment_type, it.component]);
      await conn.query(
        'INSERT INTO order_details (order_id, customer_id, employee_id, garment_id, service_type, measurement_value, order_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [o.insertId, customerId, d.employee_id, g.insertId, d.service_type, it.measurement, it.price]
      );
    }
    return { order_id: o.insertId, order_code: code, total };
  });

  res.status(201).json(result);
}));

/* ------------------------------------------------------------------ */
/* List orders: admin (filters) / tailor (own active tasks)            */
/* ------------------------------------------------------------------ */
async function queryOrders(where, params, orderBy) {
  const [rows] = await pool.query(
    `SELECT o.order_id, o.order_code, o.order_status, o.total_amount, o.est_pickup_date, o.created_at,
            MAX(c.firstname) AS firstname, MAX(c.lastname) AS lastname, MAX(c.phone) AS phone,
            GROUP_CONCAT(DISTINCT od.service_type SEPARATOR ', ') AS services,
            GROUP_CONCAT(DISTINCT g.suit_type SEPARATOR ', ') AS suit_types
     FROM orders o
     JOIN order_details od ON o.order_id = od.order_id
     JOIN customer c ON od.customer_id = c.customer_id
     JOIN garment g ON od.garment_id = g.garment_id
     WHERE ${where.join(' AND ')}
     GROUP BY o.order_id, o.order_code, o.order_status, o.total_amount, o.est_pickup_date, o.created_at
     ORDER BY ${orderBy}
     LIMIT 500`,
    params
  );
  return rows.map((r) => ({
    order_id: r.order_id,
    order_code: r.order_code,
    status: r.order_status,
    total: Number(r.total_amount),
    due_date: r.est_pickup_date,
    created_at: r.created_at,
    customer: `${r.firstname} ${r.lastname}`,
    phone: r.phone,
    services: r.services,
    suit_types: r.suit_types,
    overdue: isOverdue(r.order_status, r.est_pickup_date),
  }));
}

/* ------------------------------------------------------------------ */
/* Service desk pickup list: orders that are Ready for handover        */
/* ------------------------------------------------------------------ */
router.get('/pickup', requireRole('service', 'admin'), ah(async (req, res) => {
  const where = ["o.order_status = 'Ready'"];
  const params = [];
  const search = String(req.query.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    where.push("(c.firstname LIKE ? OR c.lastname LIKE ? OR CONCAT(c.firstname, ' ', c.lastname) LIKE ? OR c.phone LIKE ? OR o.order_code LIKE ?)");
    params.push(like, like, like, like, like);
  }
  res.json(await queryOrders(where, params, 'o.est_pickup_date ASC, o.order_id ASC'));
}));

/* ------------------------------------------------------------------ */
/* List orders: admin (filters) / tailor (own active tasks)            */
/* ------------------------------------------------------------------ */
router.get('/', requireRole('admin', 'tailor'), ah(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  let orderBy = 'o.created_at DESC, o.order_id DESC';

  if (req.user.role === 'tailor') {
    where.push('od.employee_id = ?', "o.order_status IN ('Pending','Assigned','Ready')");
    params.push(req.user.id);
    orderBy = "FIELD(o.order_status, 'Assigned', 'Pending', 'Ready'), o.est_pickup_date ASC, o.order_id ASC";
  } else {
    const search = String(req.query.search || '').trim();
    if (search) {
      const like = `%${search}%`;
      where.push("(c.firstname LIKE ? OR c.lastname LIKE ? OR CONCAT(c.firstname, ' ', c.lastname) LIKE ? OR od.service_type LIKE ? OR g.suit_type LIKE ? OR o.order_code LIKE ?)");
      params.push(like, like, like, like, like, like);
    }
    const status = String(req.query.status || '');
    if (status) {
      if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status filter.');
      where.push('o.order_status = ?');
      params.push(status);
    }
    switch (req.query.dateFilter) {
      case 'daily': where.push('DATE(o.created_at) = CURDATE()'); break;
      case 'weekly': where.push('YEARWEEK(o.created_at, 1) = YEARWEEK(CURDATE(), 1)'); break;
      case 'monthly': where.push('MONTH(o.created_at) = MONTH(CURDATE()) AND YEAR(o.created_at) = YEAR(CURDATE())'); break;
      case 'yearly': {
        const y = parseInt(req.query.year, 10);
        if (Number.isInteger(y) && y >= 2000 && y <= 2100) {
          where.push('YEAR(o.created_at) = ?');
          params.push(y);
        }
        break;
      }
      default: break;
    }
  }
  res.json(await queryOrders(where, params, orderBy));
}));

/* ------------------------------------------------------------------ */
/* Single order detail                                                  */
/* ------------------------------------------------------------------ */
async function loadOrder(id, conn = pool) {
  const [rows] = await conn.query(
    `SELECT o.order_id, o.order_code, o.order_status, o.total_amount, o.est_pickup_date, o.created_at,
            od.order_details_id, od.employee_id, od.service_type, od.measurement_value, od.order_price,
            c.customer_id, c.firstname, c.lastname, c.email, c.phone,
            e.firstname AS emp_first, e.lastname AS emp_last,
            g.suit_type, g.garment_type, g.garment_component,
            f.fabric_color, f.fabric_pattern, f.fabric_material
     FROM orders o
     JOIN order_details od ON o.order_id = od.order_id
     JOIN customer c ON od.customer_id = c.customer_id
     JOIN employee e ON od.employee_id = e.employee_id
     JOIN garment g ON od.garment_id = g.garment_id
     JOIN fabric f ON g.fabric_id = f.fabric_id
     WHERE o.order_id = ?
     ORDER BY od.order_details_id`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    order_id: r.order_id,
    order_code: r.order_code,
    status: r.order_status,
    total: Number(r.total_amount),
    due_date: r.est_pickup_date,
    overdue: isOverdue(r.order_status, r.est_pickup_date),
    created_at: r.created_at,
    service_type: r.service_type,
    suit_type: r.suit_type,
    employee_id: r.employee_id,
    tailor_name: `${r.emp_first} ${r.emp_last}`,
    customer: { customer_id: r.customer_id, firstname: r.firstname, lastname: r.lastname, email: r.email, phone: r.phone },
    fabric: r.service_type === 'Tailoring' ? { color: r.fabric_color, pattern: r.fabric_pattern, material: r.fabric_material } : null,
    items: rows.map((x) => ({
      id: x.order_details_id,
      garment_type: x.garment_type,
      component: x.garment_component,
      measurement: x.measurement_value,
      price: Number(x.order_price),
    })),
  };
}

const idParam = (req) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid order id.');
  return id;
};

router.get('/:id', requireRole('admin', 'tailor', 'service'), ah(async (req, res) => {
  const order = await loadOrder(idParam(req));
  if (!order) throw new HttpError(404, 'Order not found.');
  if (req.user.role === 'tailor' && order.employee_id !== req.user.id) throw new HttpError(403, 'You are not assigned to this order.');
  res.json(order);
}));

/* ------------------------------------------------------------------ */
/* Status change — replaces tailor/update_status.php                   */
/* ------------------------------------------------------------------ */
async function afterStatusChange(req, order, prev, next) {
  notifyChanged(req, order.order_code);
  if (next === 'Ready' && prev !== 'Ready') {
    sendReadyNotification({ order_code: order.order_code, firstname: order.customer.firstname, email: order.customer.email })
      .catch((e) => console.error('Ready notification failed:', e.message));
  }
}

router.patch('/:id/status', requireRole('admin', 'tailor', 'service'), ah(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(STATUSES) }), req.body);
  const order = await loadOrder(idParam(req));
  if (!order) throw new HttpError(404, 'Order not found.');

  if (req.user.role === 'tailor') {
    if (order.employee_id !== req.user.id) throw new HttpError(403, 'You are not assigned to this order.');
    if (!TAILOR_TRANSITIONS[order.status]?.includes(status)) {
      throw new HttpError(400, `Cannot move an order from ${order.status} to ${status}.`);
    }
  }
  if (req.user.role === 'service' && !SERVICE_TRANSITIONS[order.status]?.includes(status)) {
    throw new HttpError(400, 'The service desk can only mark Ready orders as Collected.');
  }

  await pool.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [status, order.order_id]);
  await afterStatusChange(req, order, order.status, status);
  res.json({ status });
}));

/* ------------------------------------------------------------------ */
/* Admin edit                                                           */
/* ------------------------------------------------------------------ */
const updateSchema = z.object({
  firstname: z.string().trim().min(1).max(50),
  lastname: z.string().trim().min(1).max(50),
  status: z.enum(STATUSES),
  employee_id: z.number().int().positive(),
  items: z.array(z.object({
    id: z.number().int().positive(),
    measurement: z.string().trim().min(1).max(100),
    price: z.number().min(0).max(1_000_000),
  })).max(60),
});

router.patch('/:id', requireRole('admin'), ah(async (req, res) => {
  const d = parse(updateSchema, req.body);
  const id = idParam(req);
  const before = await loadOrder(id);
  if (!before) throw new HttpError(404, 'Order not found.');

  await withTransaction(async (conn) => {
    const [tailor] = await conn.query("SELECT 1 FROM employee WHERE employee_id = ? AND role = 'Tailor'", [d.employee_id]);
    if (tailor.length === 0) throw new HttpError(400, 'Selected employee is not a tailor.');

    await conn.query('UPDATE customer SET firstname = ?, lastname = ? WHERE customer_id = ?', [d.firstname, d.lastname, before.customer.customer_id]);
    await conn.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [d.status, id]);
    await conn.query('UPDATE order_details SET employee_id = ? WHERE order_id = ?', [d.employee_id, id]);
    for (const it of d.items) {
      await conn.query('UPDATE order_details SET order_price = ?, measurement_value = ? WHERE order_details_id = ? AND order_id = ?', [it.price, it.measurement, it.id, id]);
    }
    await conn.query('UPDATE orders SET total_amount = (SELECT COALESCE(SUM(order_price), 0) FROM order_details WHERE order_id = ?) WHERE order_id = ?', [id, id]);
  });

  const after = await loadOrder(id);
  await afterStatusChange(req, after, before.status, after.status);
  res.json(after);
}));

export default router;
