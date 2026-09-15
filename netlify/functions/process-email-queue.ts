import 'dotenv/config';
import { drainEmailQueue } from '../../backend/src/utils/emailQueue';
import type { Config } from '@netlify/functions';

export default async () => {
  console.log('[email queue]', await drainEmailQueue());
};

// Scheduled functions have no publicly invokable production URL.
export const config: Config = { schedule: '* * * * *' };
