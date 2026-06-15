# BigRed//Hacks Registration Site

Standalone registration portal for BigRed//Hacks. This repo contains the auth, dashboard, profile, application form, team matching UI, and Express/Supabase API that were previously colocated with the event site.

## Structure

```text
frontend/  React + TypeScript + Vite + Tailwind
backend/   Express + TypeScript + Supabase
```

## Setup

```bash
npm install
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Fill the Supabase values in both `.env` files. The local `.env` files are ignored by git.

## Development

```bash
npm run dev:frontend
npm run dev:backend
```

The Vite dev server proxies `/api` to the backend on port `3000`.

## Verification

```bash
npm run build
npm run lint
```
