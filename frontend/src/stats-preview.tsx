import { createRoot } from 'react-dom/client';
import AdminStats from './pages/admin/AdminStats';
import './index.css';

const fields = ['status', 'school', 'level_of_study', 'form_key', 'checked_in'] as const;
const schools = ['Cornell University', 'Columbia University', 'New York University', 'Binghamton University', 'Syracuse University', 'University of Rochester', 'RIT', 'Stony Brook University', 'University at Buffalo', 'Princeton University', 'MIT', 'Carnegie Mellon University'];
const rows = Array.from({ length: 248 }, (_, i) => ({
  status: ['approved', 'approved', 'approved', 'pending', 'waitlisted', 'rejected'][i % 6],
  school: schools[(i * 7 + Math.floor(i / 6)) % schools.length],
  level_of_study: ['Undergraduate', 'Undergraduate', 'Graduate', 'High school'][i % 4],
  form_key: i % 7 === 0 ? 'workshop' : 'registration',
  checked_in: i % 6 < 3 && i % 5 !== 0 ? 'true' : 'false',
  date: `2026-08-${String(i % 28 + 1).padStart(2, '0')}`,
}));

// This standalone preview serves synthetic aggregates only; the application and
// its authentication routes remain unchanged.
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (!String(input).startsWith('/api/admin/metrics')) return originalFetch(input, init);
  const params = new URL(String(input), location.origin).searchParams;
  const matching = rows.filter(row =>
    fields.every(key => !params.has(key) || params.get(key) === row[key]) &&
    (!params.get('from') || row.date >= params.get('from')!) &&
    (!params.get('to') || row.date <= params.get('to')!),
  );
  const result = {
    total: matching.length,
    overall_total: rows.length,
    options: Object.fromEntries(fields.map(key => [key, [...new Set(rows.map(row => row[key]))].sort()])),
    ...Object.fromEntries(fields.map(key => [`by_${key}`, matching.reduce((counts, row) => {
      counts[row[key]] = (counts[row[key]] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>)])),
  };
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

createRoot(document.getElementById('root')!).render(
  <main className="mx-auto min-h-screen max-w-6xl bg-red7 p-4 sm:p-8">
    <div className="mb-6 rounded-lg border border-red6/20 bg-white px-4 py-3 font-poppins text-sm text-red6">
      <strong>Sample data preview</strong> · 248 fictional registrations, August 1–28, 2026. Try combining filters below.
    </div>
    <AdminStats />
  </main>,
);
