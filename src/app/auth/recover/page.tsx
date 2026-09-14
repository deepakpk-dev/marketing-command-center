"use client";
import { useState } from "react";
import Link from "next/link";
export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="onboarding-shell">
      <section className="panel login-panel">
        <div className="eyebrow">SIGNAL · ACCOUNT ACCESS</div>
        <h1>Forgot your password?</h1>
        <p>
          Enter your account email and we’ll send a link to choose a new
          password.
        </p>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const response = await fetch("/api/session/recovery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              setMessage(result.message);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p>
          <Link href="/" className="text-button">
            Back to sign-in
          </Link>
        </p>
      </section>
    </main>
  );
}
