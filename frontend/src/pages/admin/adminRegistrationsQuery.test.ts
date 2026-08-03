import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminRegistrationsCsvPath,
  buildAdminRegistrationsPath,
} from "./adminRegistrationsQuery.ts";

test("buildAdminRegistrationsPath includes paging, status, search, form, and check-in filters", () => {
  assert.equal(
    buildAdminRegistrationsPath({
      limit: 50,
      offset: 100,
      status: "pending",
      search: "cornell",
      formKey: "registration",
      checkedIn: "true",
    }),
    "/api/admin/registrations?limit=50&offset=100&status=pending&q=cornell&form_key=registration&checked_in=true",
  );
});

test("buildAdminRegistrationsPath omits check-in filter unless true/false", () => {
  assert.equal(buildAdminRegistrationsPath({ checkedIn: "" }), "/api/admin/registrations");
  assert.equal(
    buildAdminRegistrationsPath({ checkedIn: "false" }),
    "/api/admin/registrations?checked_in=false",
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
