import 'dotenv/config';
import serverless from 'serverless-http';
import type { Handler } from '@netlify/functions';
import app from '../../backend/src/app';

// Wrap the Express app so it runs as a Netlify Function.
// The `/api/*` redirect in netlify.toml forwards requests here, preserving the
// original `/api/...` path, which matches the routes mounted in backend/src/app.ts.
export const handler: Handler = serverless(app) as unknown as Handler;
