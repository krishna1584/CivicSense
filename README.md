# CivicSense

Citizens report civic issues (potholes, broken lights, garbage), follow them and confirm when they're fixed. Staff triage, assign and resolve them. Reports can also be filed fully anonymously, with no account.

- `frontend/` — Next.js 15, React 19, Tailwind
- `backend/` — Express, PostgreSQL, Socket.IO

## Run locally

Needs Node 18+ and PostgreSQL.

```bash
# Backend
cd backend
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npm run db:setup            # creates all tables, categories and later schema updates
npm run seed                # optional demo accounts (refuses to run in production)
npm run dev                 # http://localhost:5000

# Frontend (new terminal)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Without email settings, verification and reset codes are printed in the backend console (development only).
Without Cloudinary settings, uploads are saved to `backend/public/uploads`.

## Tests

```bash
cd backend
npm test
```

## Deploying

- **Backend start command:** `npm start`. It runs `migrate_updates.js` first, which is safe to repeat.
  If your host starts the app with `node src/index.js` instead, run `npm run migrate:updates` once per deploy.
- **Required backend settings:** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production`,
  `CLIENT_URL`/`FRONTEND_URL` (your exact frontend address), `CLOUDINARY_*`, `RESEND_API_KEY`, `SMTP_FROM`.
- **Frontend settings:** `NEXT_PUBLIC_API_URL` (and `NEXT_PUBLIC_SOCKET_URL` if sockets are on another host).

## Anonymous reporting

Anonymous reports store no account, email or IP address. The reporter gets a one-time tracking code
(only its SHA-256 hash is stored), solves a small proof-of-work puzzle to submit, and photos have their
metadata removed. Reports are held for staff review and publish automatically after 24 hours unless rejected.
