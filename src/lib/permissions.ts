import { z } from "zod";
import { ApiError } from "./errors";
export const roleSchema = z.enum(["viewer", "analyst", "approver", "admin"]);
export type WorkspaceRole = z.infer<typeof roleSchema>;
export type Permission =
  | "read"
  | "ingest"
  | "analyze"
  | "approve"
  | "manageMembers";
export type Permissions = Record<Permission, boolean>;
export function permissionsFor(input: unknown): Permissions {
  const role = roleSchema.parse(input);
  return {
    read: true,
    ingest: role === "admin" || role === "analyst",
    analyze: role === "admin" || role === "analyst",
    approve: role === "admin" || role === "approver",
    manageMembers: role === "admin",
  };
}
export function requirePermission(
  role: WorkspaceRole,
  permission: Permission,
): void {
  if (!permissionsFor(role)[permission])
    throw new ApiError(
      403,
      "Your workspace role does not have permission for this action.",
    );
}
