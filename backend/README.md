# Backend notes

See the [project README](../README.md) for local setup, schema migration, environment configuration, role setup, API details, testing, Postman, and deployment instructions.

Useful files:

- `database/schema.sql` creates the complete schema for a new database.
- `migrations/001_create_tickets.sql` adds tickets and comments to a database with the existing users table only.
- `migrations/002_upgrade_legacy_tickets.sql` upgrades the original ticket/comment tables once, preserving their signed `INT` IDs and existing rows.
- `migrations/003_add_completed_ticket_status.sql` is retained for historical reference; the current app uses `resolved` as its finished status.
- `migrations/004_use_resolved_ticket_status.sql` converts existing `completed` tickets to `resolved` and removes `completed` from the database enum.
- `database/queries.sql` contains the requested open-ticket/customer JOIN example.
- `scripts/seed.js` creates configurable sample accounts using bcrypt-hashed passwords.
- `postman/Support-Ticket-System.postman_collection.json` contains an importable API test collection.
- Run `npm test` for unit tests and `npm run test:api` for opt-in database-backed API tests; the API suite cleans up its temporary records.
