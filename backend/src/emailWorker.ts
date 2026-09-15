import 'dotenv/config';
import { drainEmailQueue } from './utils/emailQueue';

// One bounded pass for deployments outside Netlify. Invoke once per minute.
drainEmailQueue().then(result => console.log('[email queue]', result)).catch(() => {
  console.error('[email queue] Worker failed. Check database access and retry on the next run.');
  process.exitCode = 1;
});
