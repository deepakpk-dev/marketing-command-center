import { describe, expect, it } from "vitest";
import { permissionsFor, requirePermission } from "../src/lib/permissions";

describe("workspace capabilities", () => {
  it("lets viewers read but never mutate or manage access", () => {
    expect(permissionsFor("viewer")).toEqual({
      read: true,
      ingest: false,
      analyze: false,
      approve: false,
      manageMembers: false,
    });
    expect(() => requirePermission("viewer", "approve")).toThrow(/permission/i);
    expect(() => requirePermission("viewer", "ingest")).toThrow(/permission/i);
  });
  it("separates analyst and approver duties", () => {
    expect(permissionsFor("analyst")).toEqual({
      read: true,
      ingest: true,
      analyze: true,
      approve: false,
      manageMembers: false,
    });
    expect(permissionsFor("approver")).toEqual({
      read: true,
      ingest: false,
      analyze: false,
      approve: true,
      manageMembers: false,
    });
    expect(() => requirePermission("analyst", "approve")).toThrow();
  });
  it("grants admins all capabilities and denies unknown roles", () => {
    expect(permissionsFor("admin")).toEqual({
      read: true,
      ingest: true,
      analyze: true,
      approve: true,
      manageMembers: true,
    });
    expect(() => permissionsFor("owner")).toThrow();
  });
});
