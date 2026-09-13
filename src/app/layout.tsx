import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Signal | AI Performance Marketing Command Center",
  description:
    "A performance marketing workspace for validated data, KPI analysis, anomaly detection and human-reviewed recommendations.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
