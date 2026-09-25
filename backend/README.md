# Backend notes

See the [project README](../README.md) for local setup, schema migration, environment configuration, role setup, API details, testing, Postman, and deployment instructions.

Useful files:

- `database/schema.sql` creates the complete schema for a new database.
- `migrations/001_create_tickets.sql` adds tickets and comments to an existing users table.
- `database/queries.sql` contains the requested open-ticket/customer JOIN example.
- `scripts/seed.js` creates configurable sample accounts using bcrypt-hashed passwords.
- `postman/Support-Ticket-System.postman_collection.json` contains an importable API test collection.
