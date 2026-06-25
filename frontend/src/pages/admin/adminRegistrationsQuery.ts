interface AdminRegistrationsQueryOptions {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
  formKey?: string;
}

function buildQuery(options: AdminRegistrationsQueryOptions): string {
  const params = new URLSearchParams();

  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    params.set("offset", String(options.offset));
  }
  if (options.status?.trim()) {
    params.set("status", options.status.trim());
  }
  if (options.search?.trim()) {
    params.set("q", options.search.trim());
  }
  if (options.formKey?.trim()) {
    params.set("form_key", options.formKey.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildAdminRegistrationsPath(options: AdminRegistrationsQueryOptions): string {
  return `/api/admin/registrations${buildQuery(options)}`;
}

export function buildAdminRegistrationsCsvPath(options: AdminRegistrationsQueryOptions): string {
  return `/api/admin/registrations/export.csv${buildQuery({
    status: options.status,
    search: options.search,
    formKey: options.formKey,
  })}`;
}
