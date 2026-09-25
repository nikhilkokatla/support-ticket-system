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
│   ├── migrations/           # Add tickets and comments to an existing users table
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
3. Check the type and signedness of `users.id` with `SHOW CREATE TABLE users;`. In `backend/migrations/001_create_tickets.sql`, make `tickets.user_id`, `tickets.assigned_to`, and `ticket_comments.user_id` match that type. Then apply the migration with your MySQL password prompt:

   ```sh
   mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/migrations/001_create_tickets.sql
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

Import `backend/postman/Support-Ticket-System.postman_collection.json` into Postman. Set its collection variables with local test customer and agent credentials. Run the customer requests first, then the agent requests; the login response sets the cookie used by following requests. The collection covers registration, login and invalid login, ticket create/read/update/delete, comments, role restrictions, agent statistics, and user listing.

The automated Node tests exercise validation and ticket ownership rules. The Postman requests are database-backed and require the schema, configured credentials, and running API.

## Deployment

`render.yaml` builds the Vite frontend and runs the Express API as one Render web service. The backend serves the compiled frontend, so the deployed application uses one origin. To deploy:

1. Push this project to a GitHub repository.
2. Create a Render Blueprint from that repository and review the service settings.
3. Configure `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT` with a remotely reachable MySQL database. Apply the schema/migration there before testing. Render's blueprint does not create a MySQL server.
4. Render generates `JWT_SECRET` for the service. Keep all database values in Render's environment settings; do not put them in Git.
5. Deploy, check `/health`, and test customer and support flows against the public URL. Record the live app URL and GitHub repository URL for submission.

Deployment is not complete until the external GitHub repository and public hosting service are connected and the required remote MySQL database is configured.
