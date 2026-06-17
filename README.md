# BigRed//Hacks Registration Site

Standalone registration portal for BigRed//Hacks. Hackers create an account, complete a profile, fill out a server-driven application, and form or join teams. Admins manage form configs, review applications, and inspect users.

## Structure

```text
frontend/   React 19 + TypeScript + Vite + Tailwind v4
backend/    Express + TypeScript
```

Backend routes live under `/api` and are mounted in `backend/src/routes/index.ts`:
`registrations`, `participants`, `teams`, `profile`, `form-configs`, `admin`. All except `profile` require auth; `admin` additionally requires the admin role.

## Setup

```bash
npm install
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Fill in the values in both `.env` files. Optionally set `RESEND_API_KEY` in `backend/.env` to enable outbound email. Local `.env` files are gitignored.

## Development

```bash
npm run dev:frontend   # Vite on 5173
npm run dev:backend    # Express on PORT (default 3000)
# or both:
npm run dev
```

The Vite dev server proxies `/api` to the backend. Override the target with `VITE_API_PROXY_TARGET` if your backend runs on a non-default port (e.g. set `PORT=5001` in `backend/.env` and `VITE_API_PROXY_TARGET=http://localhost:5001` in `frontend/.env`).

## Verification

```bash
npm run build
npm run lint
```
