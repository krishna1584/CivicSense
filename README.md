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

- **Backend build command (Render):** `npm install && npx prisma migrate deploy && npm run build`.
  `npm run build` applies the remaining schema migrations; every step is safe to repeat on each deploy.
- **Backend start command:** `npm start`. It runs `migrate_updates.js` first, which is safe to repeat.
  If your host starts the app with `node src/index.js` instead, run `npm run migrate:updates` once per deploy.

## Environment variables

Full descriptions are in `backend/.env.example` and `frontend/.env.local.example`.
The backend checks its settings at startup: it stops if a required one is missing and warns about the rest.

| Variable | Where | Needed |
|---|---|---|
| `DATABASE_URL` | backend | Always |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | backend | Always (two different random strings) |
| `NODE_ENV=production` | backend | Production |
| `FRONTEND_URL` | backend | Production (exact frontend address) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | backend | Production, or emails aren't sent |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | backend | Production, or uploads are lost on redeploy |
| `PORT`, `CORS_EXTRA_ORIGINS`, `POW_DIFFICULTY_BITS`, `EMAIL_FROM` | backend | Optional |
| `NEXT_PUBLIC_API_URL` | frontend | Production |
| `NEXT_PUBLIC_SOCKET_URL` | frontend | Optional |

`CLIENT_URL` and `SMTP_FROM` are older names for `FRONTEND_URL` and `EMAIL_FROM`; they still work.

### Email on Render's free plan

Email is sent over SMTP with Nodemailer. Render's free plan blocks outgoing SMTP, so on that
plan codes can't be delivered. The backend tests its SMTP connection at startup, and the
sign-up, verify-email and password-reset pages then show a notice explaining this.
Email works locally, or on any host or paid plan that allows outgoing SMTP.

## Anonymous reporting

Anonymous reports store no account, email or IP address. The reporter gets a one-time tracking code
(only its SHA-256 hash is stored), solves a small proof-of-work puzzle to submit, and photos have their
metadata removed. Reports are held for staff review and publish automatically after 24 hours unless rejected.
