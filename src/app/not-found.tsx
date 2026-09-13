import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>Page not found</h1>
      <p>Return to your performance workspace.</p>
      <Link className="button primary" href="/">
        Open Signal
      </Link>
    </main>
  );
}
