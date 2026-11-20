import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah } from '../utils/http.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/summary', ah(async (req, res) => {
  const n = (v) => Number(v || 0);

  const [[counts]] = await pool.query(
    `SELECT SUM(order_status NOT IN ('Collected','Cancelled')) AS open_orders,
            SUM(order_status = 'Pending') AS pending, SUM(order_status = 'Assigned') AS assigned,
            SUM(order_status = 'Ready') AS ready, SUM(order_status = 'Collected') AS collected,
            SUM(order_status = 'Cancelled') AS cancelled
     FROM orders`
  );
  const [[tailors]] = await pool.query("SELECT COUNT(*) AS total FROM employee WHERE role = 'Tailor' AND employee_status = 'Active'");

  const [[overdue]] = await pool.query(
    "SELECT COUNT(*) AS total FROM orders WHERE order_status IN ('Pending','Assigned','Ready') AND est_pickup_date < CURDATE()"
  );

  const [weekly] = await pool.query(
    `SELECT MIN(DATE(created_at)) AS week_start, COUNT(*) AS total
     FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
     GROUP BY YEARWEEK(created_at, 1) ORDER BY YEARWEEK(created_at, 1)`
  );

  const [materials] = await pool.query(
    `SELECT f.fabric_material AS material, COUNT(DISTINCT o.order_id) AS total
     FROM orders o
     JOIN order_details od ON o.order_id = od.order_id
     JOIN garment g ON od.garment_id = g.garment_id
     JOIN fabric f ON g.fabric_id = f.fabric_id
     WHERE od.service_type = 'Tailoring'
     GROUP BY f.fabric_material ORDER BY total DESC`
  );

  const [workload] = await pool.query(
    `SELECT e.employee_id, e.firstname, e.lastname,
            COUNT(DISTINCT CASE WHEN o.order_status <> 'Cancelled' THEN o.order_id END) AS total,
            COUNT(DISTINCT CASE WHEN o.order_status IN ('Ready','Collected') THEN o.order_id END) AS done,
            COUNT(DISTINCT CASE WHEN o.order_status = 'Assigned' THEN o.order_id END) AS assigned
     FROM employee e
     LEFT JOIN order_details od ON od.employee_id = e.employee_id
     LEFT JOIN orders o ON o.order_id = od.order_id
     WHERE e.role = 'Tailor' AND e.employee_status = 'Active'
     GROUP BY e.employee_id, e.firstname, e.lastname
     ORDER BY e.firstname`
  );

  res.json({
    cards: {
      activeTailors: n(tailors.total),
      openOrders: n(counts.open_orders),
      assigned: n(counts.assigned),
      ready: n(counts.ready),
      collected: n(counts.collected),
      overdue: n(overdue.total),
    },
    byStatus: [
      { status: 'Pending', count: n(counts.pending) },
      { status: 'Assigned', count: n(counts.assigned) },
      { status: 'Ready', count: n(counts.ready) },
      { status: 'Collected', count: n(counts.collected) },
      { status: 'Cancelled', count: n(counts.cancelled) },
    ],
    weekly: weekly.map((w) => ({ week: w.week_start, count: n(w.total) })),
    materials: materials.map((m) => ({ material: String(m.material).replaceAll('_', ' '), count: n(m.total) })),
    workload: workload.map((w) => ({
      employee_id: w.employee_id,
      name: `${w.firstname} ${w.lastname}`,
      total: n(w.total),
      done: n(w.done),
      assigned: n(w.assigned),
      progress: n(w.total) > 0 ? Math.round((n(w.done) / n(w.total)) * 100) : 0,
    })),
  });
}));

export default router;
