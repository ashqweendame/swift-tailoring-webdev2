# Swift Tailoring — Web Development 2

The Information Management PHP/MySQL app, rebuilt as a REST API + single-page app.
**The MySQL schema (`tailor_swift_db`) is unchanged.** Point the API at your existing database.

```
server/   Node + Express REST API (JWT auth, role middleware, Socket.io, Nodemailer)
client/   Vite + React SPA (React Router, Recharts, socket.io-client)
```

## 1. Workspace setup (first time only)

### 1.1 Install the tools

| Tool              | Where                         | Notes                                                                                                       |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Node.js (LTS)** | https://nodejs.org            | Keep **Add to PATH** enabled. Leave **"Tools for Native Modules"** unchecked; this project doesn't need it. |
| **XAMPP**         | https://www.apachefriends.org | Only **MySQL** is needed (Apache is not). phpMyAdmin comes with it.                                         |
| **VS Code**       | https://code.visualstudio.com | Optional extensions: _ES7+ React/Redux/React-Native snippets_, _Prettier_.                                  |

After installing Node.js, **close and reopen any terminal or VS Code window**, then check it works:

```
node -v
npm -v
```

Both must print a version number. If you get "not recognized", see Troubleshooting below.

### 1.2 Open the project in VS Code

1. Unzip `swift-tailoring-webdev2.zip` to any folder (for example your Desktop). It does **not** go in `htdocs`; Node serves this app, not Apache.
2. In VS Code: **File → Open Folder…** and choose the `swift-tailoring-webdev2` folder. Click **Yes, I trust the authors** if asked.
3. Open the terminal with **Terminal → New Terminal** (shortcut: Ctrl + `). You will use two terminals: click the **split** icon (or **+**) in the terminal panel to open the second one.

```
swift-tailoring-webdev2/
├── server/   Node + Express API
└── client/   React website
```

### 1.3 Prepare the database

1. Open the XAMPP Control Panel and **Start MySQL**.
2. Open http://localhost/phpmyadmin (phpMyAdmin needs Apache running only for this step; start Apache if the page won't load).
3. Make sure the database `tailor_swift_db` exists with your data. If not, create it and use **Import** with the SQL file attached with the folder.

The schema is not modified by this project.

### 1.4 Set up the API (terminal 1)

```
cd server
copy .env.example .env
npm install
```

(On macOS/Linux use `cp .env.example .env`.)

Open `server/.env` in VS Code and set:

- `JWT_SECRET`: any long random string, e.g. `my-long-random-secret-2026`
- `DB_PASSWORD`: your MySQL root password (leave empty for a default XAMPP install)
- Leave the `SMTP_*` lines empty unless you want real emails. "Order ready" emails are then just printed in the API terminal.

### 1.5 Set up the website (terminal 2)

```
cd client
npm install
```

Warnings about "vulnerabilities", "deprecated" or "funding" are normal. Do **not** run `npm audit fix --force`.

## 2. Run the system (every time)

1. Start **MySQL** in XAMPP.
2. Terminal 1, from `server`:
   ```
   npm run dev
   ```
   You should see `Swift Tailoring API listening on http://localhost:4000`.
3. Terminal 2, from `client`:
   ```
   npm run dev
   ```
4. Open **http://localhost:5173** in your browser.
   - Customers track orders on the home page.
   - Staff sign in at **/login**.
5. To stop, click in each terminal and press **Ctrl + C**.

Both terminals must stay running while you use the system.

Existing accounts keep working: PHP `password_hash` ($2y$) hashes are verified by the API as-is.
Seed logins from the old README: `grace_service`, `patrick_admin`, `cho_tailor`.

## 3. Troubleshooting

| Problem                                                  | Fix                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm` / `node` "is not recognized"                       | Close and reopen the terminal (or VS Code). If it persists, add `C:\Program Files\nodejs` to your PATH (Start → "Edit the system environment variables" → Environment Variables → Path → New), or rerun the Node installer with **Add to PATH** enabled. |
| "running scripts is disabled on this system"             | Run once in PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`                                                                                                                                                                            |
| `copy` says it can't find `.env.example`                 | You're in the wrong folder. Run `cd server` first.                                                                                                                                                                                                       |
| `JWT_SECRET is missing`                                  | Create `server/.env` (step 1.4) and set `JWT_SECRET`.                                                                                                                                                                                                    |
| Database connection / `ECONNREFUSED` / `ER_BAD_DB_ERROR` | Start MySQL in XAMPP, confirm `tailor_swift_db` exists, and check `DB_*` in `server/.env`.                                                                                                                                                               |
| `ER_ACCESS_DENIED_ERROR`                                 | `DB_PASSWORD` in `.env` doesn't match your MySQL root password.                                                                                                                                                                                          |
| `EADDRINUSE` (port 4000 or 5173 in use)                  | Another copy is already running. Close the old terminal, or change `PORT` in `server/.env`.                                                                                                                                                              |
| Site loads but login or tracking fails                   | The API terminal isn't running or crashed. Check terminal 1 for the error.                                                                                                                                                                               |
| Edited `.env` but nothing changed                        | Stop the API (Ctrl + C) and run `npm run dev` again.                                                                                                                                                                                                     |
| Moving the project to another computer                   | Delete the `node_modules` folders first (they are large), copy the project, then run `npm install` in `server` and `client` again.                                                                                                                       |

## Old file → new location

| PHP                                         | Now                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `login/login.php`                           | `POST /api/auth/login` → JWT, `client/src/pages/Login.jsx`                                   |
| `customer/index.php`                        | `GET /api/orders/track/:code` (public), `pages/Track.jsx`                                    |
| `service/service.php` + `process_order.php` | `POST /api/orders`, `pages/Service.jsx` + `OrderForm.jsx`                                    |
| `tailor/tailor.php` + `update_status.php`   | `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`, `pages/Tailor.jsx` |
| `admin/admin.php`                           | `/api/orders`, `/api/employees`, `/api/stats/summary`, `pages/Admin*.jsx`                    |

## API

| Endpoint                                   | Access                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `POST /api/auth/login`, `GET /api/auth/me` | public / any                                                                  |
| `GET /api/orders/track/:code`              | public (rate limited)                                                         |
| `POST /api/orders`                         | service, admin                                                                |
| `GET /api/orders/pickup?search=`           | service, admin (Ready orders only)                                            |
| `GET /api/orders`                          | admin (filters) / tailor (own tasks only)                                     |
| `GET /api/orders/:id`                      | admin, service (receipts), tailor (assigned only)                             |
| `PATCH /api/orders/:id/status`             | tailor (assigned; up to Ready), service (Ready → Collected only), admin (any) |
| `PATCH /api/orders/:id`                    | admin                                                                         |
| `GET /api/employees/tailors`               | service, admin                                                                |
| `GET/POST/PATCH /api/employees`            | admin                                                                         |
| `GET /api/stats/summary`                   | admin                                                                         |

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
