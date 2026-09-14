"use client";
import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/permissions";
type Member = {
  user_id: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
};
const roles: WorkspaceRole[] = ["viewer", "analyst", "approver", "admin"];
export function WorkspaceAccess({
  data,
  onChanged,
}: {
  data: DashboardData;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [revision, setRevision] = useState(0),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<WorkspaceRole>("viewer"),
    [password, setPassword] = useState(""),
    [drafts, setDrafts] = useState<Record<string, WorkspaceRole>>({}),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const admin = data.access?.permissions.manageMembers ?? false;
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    fetch("/api/members", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setMembers(result.members);
        setDrafts({});
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => controller.abort();
  }, [admin, revision]);
  async function submit(endpoint: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(result.message);
      setRevision((value) => value + 1);
      onChanged();
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Workspace update failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="access-layout">
      {error && (
        <p role="alert" className="toast error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="toast success">
          {notice}
        </p>
      )}
      <section className="panel access-panel">
        <div className="panel-heading">
          <div>
            <h2>Your account</h2>
            <p>
              {data.access?.user.email} · {data.access?.role}
            </p>
          </div>
        </div>
        <p className="measurement-note">
          Viewer: reports and exports. Analyst: ingestion and analysis.
          Approver: human decisions. Admin: all capabilities and access
          management.
        </p>
        <form
          className="account-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await submit("/api/session", "PUT", { password }))
              setPassword("");
          }}
        >
          <label>
            New individual password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="button" disabled={busy}>
            Update my password
          </button>
        </form>
      </section>
      {admin && (
        <section className="panel access-panel">
          <div className="panel-heading">
            <div>
              <h2>Workspace members</h2>
              <p>Invite-only access, enforced in the database</p>
            </div>
          </div>
          <form
            className="invite-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await submit("/api/members", "POST", { email, role }))
                setEmail("");
            }}
          >
            <label>
              Member email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Invitation role
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as WorkspaceRole)
                }
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" disabled={busy}>
              Invite or grant access
            </button>
          </form>
          <p className="measurement-note">
            New accounts receive an email invitation. Existing accounts keep
            their password. Email delivery requires working Supabase SMTP
            settings.
          </p>
          <div className="member-list">
            {members.map((member) => (
              <article className="member-row" key={member.user_id}>
                <div>
                  <strong>{member.email}</strong>
                  <small>
                    {member.user_id === data.access?.user.id ? "You · " : ""}
                    {member.role}
                  </small>
                </div>
                <label className="member-role">
                  Role for {member.email}
                  <select
                    aria-label={`Role for ${member.email}`}
                    disabled={busy}
                    value={drafts[member.user_id] ?? member.role}
                    onChange={(event) =>
                      setDrafts((previous) => ({
                        ...previous,
                        [member.user_id]: event.target.value as WorkspaceRole,
                      }))
                    }
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button compact"
                  disabled={
                    busy ||
                    !drafts[member.user_id] ||
                    drafts[member.user_id] === member.role
                  }
                  onClick={() =>
                    void submit("/api/members", "PATCH", {
                      userId: member.user_id,
                      role: drafts[member.user_id],
                    })
                  }
                >
                  Save role
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove workspace access for ${member.email}? Their account and audit history will remain.`,
                      )
                    )
                      void submit("/api/members", "PATCH", {
                        userId: member.user_id,
                        role: null,
                      });
                  }}
                >
                  Remove access
                </button>
              </article>
            ))}
          </div>
          <p className="measurement-note">
            The last administrator cannot be removed or demoted. Removing access
            takes effect on subsequent requests, including with an existing
            token.
          </p>
        </section>
      )}
    </div>
  );
}
