export async function GET() {
  return Response.json(
    { status: "ok", application: "signal", version: "1.0.0" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
