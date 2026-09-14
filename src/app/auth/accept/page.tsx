"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function AcceptInvitation() {
  const started = useRef(false);
  const router = useRouter();
  const [proof, setProof] = useState<Record<string, string> | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const access_token = fragment.get("access_token"),
      refresh_token = fragment.get("refresh_token");
    const token_hash = fragment.get("token_hash");
    const type =
      window.location.pathname === "/auth/reset" ? "recovery" : "invite";
    window.history.replaceState({}, "", window.location.pathname);
    async function exchange() {
      if (token_hash) {
        setProof({ token_hash, type });
        return;
      }
      if (!access_token || !refresh_token)
        throw new Error(
          "Open the original email link. If it has expired, request a new reset link or ask your administrator to resend your invitation.",
        );
      const response = await fetch("/api/session/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Invitation verification failed.");
      setReady(true);
    }
    void exchange().catch((error) =>
      setError(
        error instanceof Error
          ? error.message
          : "Invitation verification failed.",
      ),
    );
  }, []);
  return (
    <main className="onboarding-shell">
      <section className="panel login-panel">
        <div className="eyebrow">SIGNAL · ACCOUNT ACCESS</div>
        <h1>Set your password</h1>
        <p>
          Set an individual password. Your workspace role controls which actions
          you can take.
        </p>
        {error && (
          <p role="alert" className="toast error">
            {error}
          </p>
        )}
        {!ready && !error && !proof && (
          <p role="status">Verifying your email link…</p>
        )}
        {proof && !ready && (
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/session/exchange", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(proof),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setProof(null);
                setReady(true);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Link verification failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Verifying…" : "Continue to set password"}
          </button>
        )}
        {ready && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              if (password !== confirm) {
                setError("Passwords do not match.");
                return;
              }
              setBusy(true);
              try {
                const response = await fetch("/api/session", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setPassword("");
                setConfirm("");
                router.replace("/workspace");
                router.refresh();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Password setup failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Your password
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
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={200}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            <p className="muted">
              Use at least 12 characters. Never share your password with another
              reviewer.
            </p>
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Set password and open workspace"}
            </button>
          </form>
        )}
        <p>
          <Link href="/auth/recover" className="text-button">
            Request a new reset link
          </Link>
        </p>
        <Link href="/workspace" className="text-button">
          Back to sign-in
        </Link>
      </section>
    </main>
  );
}
