# Support Ticket System

A React + Vite support portal backed by Node.js, Express, and MySQL. Customers can open and track tickets and exchange comments with support. Support agents manage the queue; administrators have the additional ability to delete any ticket.

## Features

- Customer registration and login with bcrypt password hashes and an eight-hour, HttpOnly JWT cookie.
- Protected API routes with database-backed role checks for `user`, `support`, and `admin`.
- Customer ticket creation, list, details, update, delete-when-open, search, filters, and sorting.
- Agent queue, ticket statistics, priority/status changes, assignment, and user list.
- Ticket comments with ownership checks, timestamps, and author details.
- Parameterized SQL, request validation, indexes, responsive frontend, and visible loading/error states.

## Project layout

```text
support-ticket-system/
├── backend/
│   ├── auth/                 # Registration and login/session endpoints
│   ├── database/             # Fresh schema and example SQL queries
│   ├── middleware/           # Authentication and role checks
│   ├── migrations/           # Create or upgrade ticket tables
│   ├── postman/              # Importable API collection
│   ├── scripts/              # Hashed sample-account and sample-ticket seeding
│   ├── tests/                # Unit tests
│   ├── tickets/              # Ticket endpoints, validation, and ownership rules
│   └── users/                # Staff-only user endpoint
├── frontend/                 # React + Vite client
└── render.yaml               # Render web-service deployment blueprint
```

## Run locally

1. Use Node.js 22.12 or newer (or Node 20.19 or newer) and a reachable MySQL database. The current application expects the existing `users` table to contain `id`, `name`, `email`, `password_hash`, `role`, and `created_at`.
2. Copy the blank keys from `backend/.env.example` to `backend/.env`. Fill in your own database settings and set `JWT_SECRET` to a fresh random value (for example, generate one locally with `openssl rand -hex 32`). Do not commit `.env` or share its values.
3. Inspect the current table structure before choosing a migration. For a database with only the existing `users` table, check `users.id` with `SHOW CREATE TABLE users;`, make the user ID columns in `backend/migrations/001_create_tickets.sql` match its type and signedness, and apply that migration. For a database created by the earlier version of this project that already has the original `tickets` and `ticket_comments` tables, inspect those tables and apply `backend/migrations/002_upgrade_legacy_tickets.sql` once. That migration preserves rows and adds assignment, category, update timestamps, indexes, and cascading comment deletion; it assumes the legacy tables use signed `INT` IDs. Do not run both migrations blindly or rerun the one-time legacy upgrade.

   ```sh
   mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/migrations/001_create_tickets.sql
   ```

   For the legacy ticket tables described above, use this command instead:

   ```sh
   mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/migrations/002_upgrade_legacy_tickets.sql
   ```

   For a new database, use `backend/database/schema.sql` instead. It creates users, tickets, and comments if they do not already exist.
4. Install and start the backend:

   ```sh
   cd backend
   npm ci
   npm start
   ```

5. In another terminal, start the frontend:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

   Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The Vite development proxy sends `/api` calls to the backend on port 5000. The backend health endpoint is `http://localhost:5000/health`.

### Create support and admin accounts

Public registration always creates a regular `user`; users cannot promote themselves. Promote specific existing accounts from an authenticated MySQL session after checking the target email:

```sql
UPDATE users SET role = 'support' WHERE email = 'agent@example.com';
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

Alternatively, set `SEED_CUSTOMER_*`, `SEED_SUPPORT_*`, and `SEED_ADMIN_*` values in your private `backend/.env`, then run `npm run seed` from `backend/`. The seed script hashes those passwords with bcrypt and creates a sample ticket and comment. It updates the name, password hash, and role for the exact seed emails you configure; review those emails before running it. It prints the sample ticket ID so you can use it for the Postman `otherTicketId` variable. Use a different customer account in Postman to verify that one customer cannot access another customer's ticket.

## API

All endpoints return JSON. Authentication uses the `support_ticket_token` HttpOnly cookie. `/register` and `/login` remain as compatibility routes; the documented routes use `/api`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a customer |
| POST | `/api/auth/login` | Public | Log in |
| GET | `/api/auth/me` | Authenticated | Get current account |
| POST | `/api/auth/logout` | Public | Clear the login cookie |
| GET | `/api/tickets` | Authenticated | List own tickets, or all tickets for support/admin |
| POST | `/api/tickets` | Customer | Create a ticket |
| GET | `/api/tickets/:id` | Owner or support/admin | Ticket details |
| PUT | `/api/tickets/:id` | Owner (open ticket) or support/admin | Update ticket fields |
| DELETE | `/api/tickets/:id` | Owner (open ticket) or admin | Delete a ticket |
| GET | `/api/tickets/:id/comments` | Ticket owner or support/admin | View conversation |
| POST | `/api/tickets/:id/comments` | Ticket owner or support/admin | Add a comment |
| GET | `/api/dashboard/stats` | Support/admin | Queue statistics |
| GET | `/api/staff/options` | Support/admin | List assignable agents |
| GET | `/api/users` | Support/admin | List users |

Ticket list filters include `status`, `priority`, `category`, and `search`; sort by `updated`, `created`, `priority`, or `status`, with `order=asc|desc`. Statuses are `open`, `in_progress`, `resolved`, and `closed`; priorities are `low`, `medium`, `high`, and `urgent`.

The example JOIN query for open tickets and customer name/email is in `backend/database/queries.sql`.

## Tests and API collection

Run the backend unit tests and frontend checks:

```sh
cd backend && npm test
cd ../frontend && npm run lint && npm run build
```

For database-backed API integration tests, configure `backend/.env` with a reachable test database, then run `npm run test:api` from `backend/`. The suite creates uniquely named temporary accounts and tickets and removes them after the run. Keep the database available for the duration of the test command.

Import `backend/postman/Support-Ticket-System.postman_collection.json` into Postman. Set its collection variables with a valid base customer email, customer name/password, and agent/admin credentials. The registration request creates a unique plus-addressed email for each run and requires HTTP 201; the following customer login uses that generated email. Run the customer requests first, then the agent requests; the login response sets the cookie used by following requests. The collection covers registration, login and invalid login, ticket create/read/update/delete, comments, role restrictions, agent statistics, and user listing.

The automated Node tests exercise validation and ticket ownership rules. The Postman requests are database-backed and require the schema, configured credentials, and running API.

## Render deployment

`render.yaml` defines a separate backend web service and frontend static site. For a no-cost database, use TiDB Cloud Starter, which speaks the MySQL protocol and supports the app's `mysql2` driver. Its free quota is 5 GiB of row data and 50 million request units per month; operations are throttled when the free quota is reached. Keep the TiDB spending limit at zero to prevent paid usage. Render's own free Postgres expires after 30 days, and Render does not provide free persistent MySQL hosting.

Create a TiDB Cloud Starter instance in a region close to the Render services. In TiDB's Connect dialog, choose the public endpoint and copy the host, port, user, and password. Set these variables on the Render backend service: `DB_HOST`, `DB_PORT` (usually `4000`), `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. `DB_SSL=true` enables the TLS connection required by TiDB Cloud Starter. Keep the database password in Render's environment settings, never in this repository or an `.env` file.

Then create a Render Blueprint from this GitHub repository. The blueprint defines:

- Backend: root directory `backend`, build command `npm install`, start command `node server.js`, health check `/health`.
- Frontend: root directory `frontend`, build command `npm install && npm run build`, publish directory `dist`.

In the backend service settings, set `FRONTEND_URL` to the frontend's public Render URL. Render generates `JWT_SECRET` from the blueprint. In the frontend settings, set `VITE_API_URL` to the backend's public origin without a path (for example, `https://your-backend.onrender.com`); the frontend adds `/api/...` to requests. Vite embeds this value during the build; it is not a secret.

For a new TiDB database, create a database first and apply `backend/database/schema.sql` using TiDB's SQL editor or a MySQL client configured with TLS. Keep all database passwords and other secrets in Render's environment settings, never in this repository or its `.env` files. After deploying both app services, verify the backend at `/health`, then test registration, login, ticket creation, and agent ticket management through the public frontend URL.
