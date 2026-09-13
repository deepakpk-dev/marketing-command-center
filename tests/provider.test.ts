import { afterEach, expect, it, vi } from "vitest";
import { analyzeDemo, analyzeOpenAI, buildEvidence } from "../src/lib/analyst";
import { DemoRepository } from "../src/lib/repository";
import { runAnalysis } from "../src/lib/run-analysis";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("validates a structured provider response using only aggregate evidence", async () => {
  const repo = new DemoRepository(),
    evidence = buildEvidence(await repo.read(), 7, "all"),
    expected = analyzeDemo(evidence);
  vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-secret");
  let input = "";
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    input = body.input;
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(expected) }],
        },
      ],
    });
  });
  expect(await analyzeOpenAI(evidence)).toMatchObject({
    recommendations: expected.recommendations,
  });
  const sent = JSON.parse(input);
  expect(sent.facts.campaigns).toHaveLength(6);
  expect(sent).not.toHaveProperty("ads");
  expect(sent).not.toHaveProperty("analytics");
});
it("does not save analysis or actions when a provider request fails", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-secret");
  vi.stubEnv("DATA_MODE", "supabase");
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubGlobal(
    "fetch",
    async () => new Response("Provider error", { status: 503 }),
  );
  const repo = new DemoRepository(),
    before = await repo.read();
  await expect(
    runAnalysis(repo, 7, "all", "provider-failure-test"),
  ).rejects.toThrow(/No recommendations were saved/i);
  const after = await repo.read();
  expect(after.analyses).toHaveLength(before.analyses.length);
  expect(after.recommendations).toEqual(before.recommendations);
});
