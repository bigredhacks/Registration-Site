import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

const dimensions = [
  { key: "status", label: "Status" },
  { key: "school", label: "School" },
  { key: "level_of_study", label: "Level of study" },
  { key: "form_key", label: "Registration form" },
  { key: "checked_in", label: "Check-in" },
] as const;
type Dimension = typeof dimensions[number]["key"];
type Filters = Partial<Record<Dimension | "from" | "to", string>>;
type Metrics = {
  total: number;
  overall_total: number;
  options: Record<Dimension, string[]>;
} & Record<`by_${Dimension}`, Record<string, number>>;

const control = "w-full min-w-0 rounded-lg border border-red6/20 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red5";
const labelFor = (key: Dimension, value: string) => {
  if (!value) return "Not provided";
  if (key === "checked_in") return value === "true" ? "Checked in" : "Not checked in";
  if (key === "status") return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
};
const percentage = (count: number, total: number) => total ? `${(count / total * 100).toFixed(1)}%` : "0.0%";

export default function AdminStats() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [dimension, setDimension] = useState<Dimension>("status");
  const [sort, setSort] = useState("most");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const query = new URLSearchParams(filters).toString();
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to);

  useEffect(() => {
    if (invalidDates) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    apiFetch(`/api/admin/metrics?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load statistics. Please try again.");
        const result: Metrics = await response.json();
        if (active) setMetrics(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load statistics.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [query, refresh, invalidDates]);

  const entries = useMemo(() => {
    return Object.entries(metrics?.[`by_${dimension}`] ?? {})
      .filter(([value]) => labelFor(dimension, value).toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        const alphabetical = labelFor(dimension, a[0]).localeCompare(labelFor(dimension, b[0]));
        return sort === "name" ? alphabetical : (sort === "least" ? a[1] - b[1] : b[1] - a[1]) || alphabetical;
      });
  }, [metrics, dimension, search, sort]);

  function updateFilter(key: keyof Filters, value: string | undefined) {
    setLoading(true);
    setFilters((current) => {
      const next = { ...current };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  const activeFilters = Object.keys(filters).length;
  const ready = metrics && !loading && !error && !invalidDates;
  const selectedLabel = dimensions.find((item) => item.key === dimension)!.label;

  return (
    <div className="flex flex-col gap-5 font-poppins">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-3xl font-jersey10 text-red6">Stats</h2>
        <button type="button" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }} disabled={loading || invalidDates}
          className="rounded-lg border border-red6/20 bg-white px-4 py-2 text-sm font-semibold text-red6 hover:bg-red7 disabled:opacity-50">
          Refresh
        </button>
      </div>

      <section aria-label="Registration filters" className="rounded-xl border border-red6/20 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-red6">Filters <span className="ml-1 text-xs font-normal text-gray-500">{activeFilters ? `${activeFilters} active` : "All registrations"}</span></h3>
          <button type="button" disabled={!activeFilters} onClick={() => { setLoading(true); setFilters({}); }}
            className="text-sm font-semibold text-red6 underline underline-offset-4 disabled:opacity-40">Reset filters</button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dimensions.map(({ key, label }) => (
            <label key={key} className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-gray-600">
              {label}
              <select className={control} value={filters[key] === undefined ? "all" : `value:${filters[key]}`}
                onChange={(event) => updateFilter(key, event.target.value === "all" ? undefined : event.target.value.slice(6))}>
                <option value="all">All</option>
                {(metrics?.options[key] ?? []).map((value) => <option key={value} value={`value:${value}`}>{labelFor(key, value)}</option>)}
              </select>
            </label>
          ))}
          <div className="grid grid-cols-2 gap-2">
            {([['from', 'From (UTC)'], ['to', 'Through (UTC)']] as const).map(([key, label]) => (
              <label key={key} className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-gray-600">
                {label}
                <input type="date" className={control} value={filters[key] ?? ""} aria-invalid={invalidDates}
                  onChange={(event) => updateFilter(key, event.target.value || undefined)} />
              </label>
            ))}
          </div>
        </div>
        {invalidDates && <p role="alert" className="mt-3 text-sm text-red6">Start date must be on or before end date.</p>}
      </section>

      <div aria-live="polite" aria-busy={loading && !invalidDates}>
        {invalidDates ? null : error ? (
          <div role="alert" className="rounded-xl border border-red6/20 bg-white p-6 text-sm text-red6">
            <p>{error}</p>
            <button type="button" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }} className="mt-3 font-semibold underline">Try again</button>
          </div>
        ) : !ready ? <p role="status" className="py-8 text-sm text-gray-500">Loading statistics…</p> : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary label="Matching registrations" value={metrics.total.toLocaleString()} detail={`${percentage(metrics.total, metrics.overall_total)} of ${metrics.overall_total.toLocaleString()} total`} primary />
            <Summary label="Approved" value={(metrics.by_status.approved ?? 0).toLocaleString()} detail={`${percentage(metrics.by_status.approved ?? 0, metrics.total)} of matching registrations`} />
            <Summary label="Checked in" value={(metrics.by_checked_in.true ?? 0).toLocaleString()} detail={`${percentage(metrics.by_checked_in.true ?? 0, metrics.total)} of matching registrations`} />
          </div>
        )}
      </div>

      <section aria-label="Statistics breakdown" className="overflow-hidden rounded-xl border border-red6/20 bg-white">
        <div className="flex flex-wrap items-end gap-4 border-b border-red6/10 p-5">
          <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-xs font-semibold text-gray-600">
            Break down by
            <select value={dimension} onChange={(event) => { setDimension(event.target.value as Dimension); setSearch(""); }} className={control}>
              {dimensions.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-xs font-semibold text-gray-600">
            Find a group
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${selectedLabel.toLowerCase()}…`} className={control} />
          </label>
          <label className="flex min-w-40 flex-col gap-1.5 text-xs font-semibold text-gray-600">
            Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={control}>
              <option value="most">Most registrations</option><option value="least">Fewest registrations</option><option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
        {ready && (metrics.total === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No registrations match these filters. Try widening your selection.</p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No groups match “{search}”. Clear your search to see the breakdown.</p>
        ) : (
          <div className="p-5">
            <p className="mb-4 text-xs text-gray-500">{entries.length} groups · Percentages use all {metrics.total.toLocaleString()} matching registrations.</p>
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="text-xs text-gray-500"><tr><th scope="col" className="w-[55%] pb-3 font-medium">{selectedLabel}</th><th scope="col" className="pb-3 text-right font-medium">Count</th><th scope="col" className="pb-3 text-right font-medium">Share</th></tr></thead>
                <tbody>
                  {entries.map(([value, count]) => (
                    <tr key={value} className="border-t border-red6/10">
                      <th scope="row" className="py-3 pr-4 font-normal">
                        <span className="block break-words">{labelFor(dimension, value)}</span>
                        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-red7"><div className="h-full rounded-full bg-red5 motion-safe:transition-[width]" style={{ width: `${count / metrics.total * 100}%` }} /></div>
                      </th>
                      <td className="py-3 text-right font-semibold tabular-nums text-red6">{count.toLocaleString()}</td>
                      <td className="py-3 text-right tabular-nums text-gray-600">{percentage(count, metrics.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Summary({ label, value, detail, primary = false }: { label: string; value: string; detail: string; primary?: boolean }) {
  return (
    <div className={`rounded-xl p-5 ${primary ? "bg-red6 text-white" : "border border-red6/20 bg-white text-red6"}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="my-1 text-5xl font-jersey10 tabular-nums">{value}</p>
      <p className={`text-xs ${primary ? "text-white/80" : "text-gray-500"}`}>{detail}</p>
    </div>
  );
}
