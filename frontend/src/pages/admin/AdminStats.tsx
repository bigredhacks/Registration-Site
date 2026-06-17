import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast/ToastContext";

interface Metrics {
  total: number;
  by_status: Record<string, number>;
  by_school: Record<string, number>;
  by_level_of_study: Record<string, number>;
}

export default function AdminStats() {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/admin/metrics")
      .then(async (res) => {
        if (!res.ok) {
          showToast("Failed to load metrics.", "error");
          setLoading(false);
          return;
        }
        setMetrics(await res.json());
        setLoading(false);
      })
      .catch(() => {
        showToast("Failed to load metrics.", "error");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="font-poppins text-gray-500">Loading…</p>;
  if (!metrics) return <p className="font-poppins text-gray-500">No data.</p>;

  return (
    <div className="flex flex-col gap-5">
      {/* Total */}
      <div className="bg-white border border-red6/20 rounded-lg px-6 py-5">
        <p className="text-xs font-poppins font-semibold text-gray-500 uppercase tracking-widest">
          Total Registrations
        </p>
        <p className="text-4xl font-jersey10 text-red6 mt-1">{metrics.total}</p>
      </div>

      <Tally title="By Status" data={metrics.by_status} />
      <Tally title="By School" data={metrics.by_school} truncate={10} />
      <Tally title="By Level of Study" data={metrics.by_level_of_study} />
    </div>
  );
}

function Tally({ title, data, truncate }: { title: string; data: Record<string, number>; truncate?: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const shown = truncate ? entries.slice(0, truncate) : entries;
  const remainder = truncate && entries.length > truncate ? entries.length - truncate : 0;

  return (
    <div className="bg-white border border-red6/20 rounded-lg px-6 py-5">
      <p className="font-poppins font-semibold text-red6 mb-3">{title}</p>
      {shown.length === 0 ? (
        <p className="text-sm font-poppins text-gray-400">No data.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map(([key, count]) => (
            <li key={key} className="flex items-center justify-between text-sm font-poppins text-gray-800">
              <span>{key || "—"}</span>
              <span className="font-semibold text-red6 tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      )}
      {remainder > 0 && (
        <p className="text-xs font-poppins text-gray-400 mt-2">+ {remainder} more</p>
      )}
    </div>
  );
}
