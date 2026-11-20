# Swift Tailoring — Web Development 2

The Information Management PHP/MySQL app, rebuilt as a REST API + single-page app.
**The MySQL schema (`tailor_swift_db`) is unchanged.** Point the API at your existing database.

```
server/   Node + Express REST API (JWT auth, role middleware, Socket.io, Nodemailer)
client/   Vite + React SPA (React Router, Recharts, socket.io-client)
```

## Run it

1. Start MySQL (XAMPP) with `tailor_swift_db` imported, as before.
2. API:
   ```
   cd server
   cp .env.example .env      # set JWT_SECRET, DB_* if needed
   npm install
   npm run dev               # http://localhost:4000
   ```
3. Client (second terminal):
   ```
   cd client
   npm install
   npm run dev               # http://localhost:5173
   ```

Existing accounts keep working: PHP `password_hash` ($2y$) hashes are verified by the API as-is.
Seed logins from the old README: `grace_service`, `patrick_admin`, `cho_tailor`.

## Old file → new location

| PHP | Now |
|---|---|
| `login/login.php` | `POST /api/auth/login` → JWT, `client/src/pages/Login.jsx` |
| `customer/index.php` | `GET /api/orders/track/:code` (public), `pages/Track.jsx` |
| `service/service.php` + `process_order.php` | `POST /api/orders`, `pages/Service.jsx` + `OrderForm.jsx` |
| `tailor/tailor.php` + `update_status.php` | `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`, `pages/Tailor.jsx` |
| `admin/admin.php` | `/api/orders`, `/api/employees`, `/api/stats/summary`, `pages/Admin*.jsx` |

## API

| Endpoint | Access |
|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | public / any |
| `GET /api/orders/track/:code` | public (rate limited) |
| `POST /api/orders` | service, admin |
| `GET /api/orders/pickup?search=` | service, admin (Ready orders only) |
| `GET /api/orders` | admin (filters) / tailor (own tasks only) |
| `GET /api/orders/:id` | admin, service (receipts), tailor (assigned only) |
| `PATCH /api/orders/:id/status` | tailor (assigned; up to Ready), service (Ready → Collected only), admin (any) |
| `PATCH /api/orders/:id` | admin |
| `GET /api/employees/tailors` | service, admin |
| `GET/POST/PATCH /api/employees` | admin |
| `GET /api/stats/summary` | admin |

## What changed besides the architecture

- **Security:** every query is parameterized; every route has a role check; order totals are computed on the server; the order form is validated with Zod; login and tracking are rate limited; deactivated accounts and role changes take effect immediately (JWT is re-checked against the DB); logout actually clears the session.
- **Pickup workflow:** tailors move orders Pending ⇄ Assigned → Ready and stop there. The service desk's **Order Pickup** screen lists Ready orders (search by code, name or phone), shows the amount due, and marks Ready → Collected after a confirmation. Only admins can cancel or jump statuses.
- **Overdue flag:** orders past their estimated pickup date (and not yet Collected or Cancelled) get an Overdue badge in the tailor, admin and pickup lists, plus an Overdue card on the admin dashboard.
- **Printable receipt:** from the order-created pop-up or the pickup screen. It shows the order code, items, total and a tracking link (`/?code=...`).
- **Live tracking:** the customer page joins a Socket.io room for its order code and refetches when a tailor or admin changes it. A browser notification fires when it becomes Ready (permission is requested from a button).
- **Ready email:** Nodemailer sends it when `SMTP_*` is set; otherwise it's logged to the console.
- **Admin dashboard:** Recharts for orders by status, orders per week, popular materials, and tailor workload.
- **Fixed:** admin showed `$` instead of `₱`; staff could open each other's pages.

## Limits from keeping the schema

- There is no status-history table, so the tracking timeline shows the current stage only, and there is no record of who collected an order or when.
- Payments aren't stored (no column for them). The pickup screen shows the amount due and asks staff to confirm it was collected, but nothing is saved.
- `garment` and `fabric` still get one row per component / per tailoring order, and customer, tailor and service type are still repeated on each `order_details` row.
- `fabric_id = 1` remains the shared placeholder row for alterations.
- The JWT lives in `localStorage` (simple for coursework); an httpOnly cookie would be the production choice.
