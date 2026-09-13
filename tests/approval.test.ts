import { describe, expect, it } from "vitest";
import { DemoRepository } from "../src/lib/repository";
import { buildSampleExports } from "../src/lib/samples";
import { normalizeBatch } from "../src/lib/ingestion";
describe("workflow persistence", () => {
  it("replays a source batch without duplicating facts", async () => {
    const repo = new DemoRepository();
    const batch = normalizeBatch(buildSampleExports());
    await repo.ingest(batch);
    await repo.ingest(batch);
    const state = await repo.read();
    expect(state.ads.length).toBe(336);
    expect(state.analytics.length).toBe(336);
    expect(state.ingestions.length).toBe(3);
  });
  it("isolates browser workspaces", async () => {
    const first = new DemoRepository();
    const second = new DemoRepository();
    const id = (await first.read()).recommendations[0].id;
    await first.decide(
      id,
      "approved",
      "Review checked. Apply in ad platform.",
      "Demo reviewer",
    );
    expect(
      (await second.read()).recommendations.every(
        (r) => r.status === "pending",
      ),
    ).toBe(true);
  });
  it("allows one decision and records an immutable audit event", async () => {
    const repo = new DemoRepository();
    const id = (await repo.read()).recommendations[0].id;
    await repo.decide(id, "approved", "Budget cap reviewed.", "Reviewer");
    await expect(
      repo.decide(id, "rejected", "Changed my mind.", "Reviewer"),
    ).rejects.toThrow(/already|conflict/i);
    const state = await repo.read();
    expect(state.recommendations.find((r) => r.id === id)?.status).toBe(
      "approved",
    );
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      recommendationId: id,
      decision: "approved",
      note: "Budget cap reviewed.",
    });
  });
  it("rejects unknown decisions and whitespace-only notes", async () => {
    const repo = new DemoRepository();
    const id = (await repo.read()).recommendations[0].id;
    await expect(
      repo.decide(id, "approved", "  ", "Reviewer"),
    ).rejects.toThrow();
    await expect(
      repo.decide("missing", "approved", "Reviewed", "Reviewer"),
    ).rejects.toThrow();
  });
  it("prevents approving recommendations after source data changes", async () => {
    const repo = new DemoRepository();
    const id = (await repo.read()).recommendations[0].id;
    const input = buildSampleExports();
    input.googleAds[0].metrics.costMicros += 1;
    await repo.ingest(normalizeBatch(input));
    await expect(
      repo.decide(id, "approved", "Reviewed budget.", "Reviewer"),
    ).rejects.toThrow(/changed|fresh/i);
  });
});
