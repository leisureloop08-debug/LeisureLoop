# LeisureLoop custom backend (migration workspace)

This folder is the isolated foundation for replacing Supabase. The live website
continues to use the existing Supabase project until the custom backend and every
feature have been migrated and tested.

## Current scope

- PostgreSQL schema: `schema.sql`
- Accounts: buyer, owner, admin
- Owner approval state
- Hashed password storage field (the API must generate Argon2id hashes)
- Server-side sessions (store only SHA-256 token hashes)
- One-time email verification and password-reset token records
- Venues, hourly booking requests, notifications and admin audit history

## Planned server architecture

- Node.js server/API routes
- PostgreSQL via the `pg` driver and parameterized queries
- Argon2id password hashing
- Random opaque session tokens in Secure, HttpOnly, SameSite cookies
- One-time random email tokens stored as hashes
- Server-side authorization for every owner/admin action
- Rate limits on signup, login, verification and password-reset endpoints
- CSRF protection for cookie-authenticated state-changing requests
- Email delivery through a configured SMTP service

## Required environment configuration (not committed)

- `DATABASE_URL`: PostgreSQL connection string
- `APP_ORIGIN`: canonical production origin
- `SESSION_SECRET`: high-entropy secret for signing/deriving security values
- SMTP host, port, username, password, and sender address

Never put secrets in frontend JavaScript, commit them to Git, or expose a
PostgreSQL connection string to the browser.

## Migration sequence

1. Provision a separate PostgreSQL database and apply `schema.sql`.
2. Build and test signup, login, logout, email verification and password reset.
3. Add authenticated venue, booking, notification and admin APIs.
4. Migrate existing user and business data with a verified export/import.
5. Update the frontend dashboards and test all flows in a staging deployment.
6. Switch production only after backups, security checks and end-to-end tests.
7. Retire Supabase only after production verification and a rollback window.

## Important

This is a migration workspace, not a live replacement yet. Do not remove the
existing Supabase configuration or change production login until all steps pass.
