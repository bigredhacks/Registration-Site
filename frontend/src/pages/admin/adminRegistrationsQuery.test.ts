import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminRegistrationsCsvPath,
  buildAdminRegistrationsPath,
} from "./adminRegistrationsQuery.ts";

test("buildAdminRegistrationsPath includes paging, status, search, and form filters", () => {
  assert.equal(
    buildAdminRegistrationsPath({
      limit: 50,
      offset: 100,
      status: "pending",
      search: "cornell",
      formKey: "registration",
    }),
    "/api/admin/registrations?limit=50&offset=100&status=pending&q=cornell&form_key=registration",
  );
});

test("buildAdminRegistrationsCsvPath omits empty filters", () => {
  assert.equal(
    buildAdminRegistrationsCsvPath({
      status: "",
      search: "  ",
      formKey: "",
    }),
    "/api/admin/registrations/export.csv",
  );
});
