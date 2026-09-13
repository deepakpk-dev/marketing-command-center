"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>This workspace couldn’t load</h1>
      <p>Try again to reload your performance data.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
