import { test, expect } from "@playwright/test";
import { buildSampleExports } from "../src/lib/samples";
test("failed reporting filter hides previous metrics and retry loads the selection", async ({ page }) => {
  await page.goto("/");
  const metrics = page.locator(".kpi-strip");
  await expect(metrics).toContainText("€14,144");
  await page.route("**/api/dashboard?days=28&channel=all", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Reporting temporarily unavailable." }) }),
  );
  await page.getByLabel("Reporting period").selectOption("28");
  await expect(page.locator(".toast.error")).toContainText("Reporting temporarily unavailable");
  await expect(metrics).toHaveCount(0);
  await expect(page.locator(".date-context")).toHaveCount(0);
  await page.unroute("**/api/dashboard?days=28&channel=all");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(metrics).toBeVisible();
  await expect(page.locator(".date-context")).toContainText("16 Aug to 12 Sept 2026");
  await expect(page.locator(".date-context")).toContainText("previous 28 days");
  await expect(page.locator(".toast.error")).toHaveCount(0);
});
test("complete marketer review and replay workflow", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Performance overview" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample workspace", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sync sample data" }),
  ).toBeEnabled({ timeout: 45000 });
  await page.getByLabel("Channel").selectOption("meta");
  await expect(
    page.getByRole("button", { name: "View Prospecting | Broad performance" }),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /Search.*Brand/ })).toHaveCount(0);
  await page.getByLabel("Channel").selectOption("all");
  await page
    .getByRole("button", { name: "View Search | Brand performance" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Search | Brand" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close campaign details" }).click();
  await page.getByRole("button", { name: "Approvals", exact: true }).click();
  await page.getByRole("button", { name: "Review action" }).first().click();
  await page
    .getByLabel("Review note")
    .fill("Checked attribution and budget limits.");
  await page
    .getByRole("button", { name: "Approve action", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("approved");
  await page.reload();
  await page.getByRole("button", { name: "Approvals", exact: true }).click();
  await expect(
    page.getByText("Checked attribution and budget limits."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report" }).click();
  expect((await download).suggestedFilename()).toMatch(/signal.*csv/);
  await page.getByRole("button", { name: "Sync sample data" }).click();
  await expect(page.getByRole("status")).toContainText("672");
  await page.getByRole("button", { name: "Sync sample data" }).click();
  await expect(page.getByRole("status")).toContainText("672");
  await page.getByRole("button", { name: "AI analyst", exact: true }).click();
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Analysis complete");
});
test("validates import and API input", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Performance overview" }),
  ).toBeVisible();
  const response = await page.request.post("/api/ingest", {
    data: { googleAds: [{ invalid: true }] },
  });
  expect(response.status()).toBe(400);
  const badPeriod = await page.request.get("/api/dashboard?days=900");
  expect(badPeriod.status()).toBe(400);
  const unsafe = await page.request.post("/api/analyze", {
    headers: { Origin: "https://evil.test" },
    data: { days: 7, channel: "all" },
  });
  expect(unsafe.status()).toBe(403);
});
test("mobile navigation and campaign table remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Performance overview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Campaign performance" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test("chart filtering and changed-data import refresh the approval evidence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sync sample data" }),
  ).toBeEnabled({ timeout: 45000 });
  const chart = page.getByRole("region", { name: "Performance trend" });
  await chart.getByRole("button", { name: "ROAS", exact: true }).click();
  await chart.getByRole("img").focus();
  await chart.getByRole("img").press("ArrowRight");
  await expect(chart.getByText(/ROAS \d/)).toBeVisible();
  await page.getByLabel("Reporting period").selectOption("14");
  await expect(page.getByText("30 Aug to 12 Sept 2026")).toBeVisible();
  await page.getByLabel("Reporting period").selectOption("7");
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  const batch = buildSampleExports();
  batch.googleAds[batch.googleAds.length - 1].metrics.costMicros += 1000000;
  await page
    .getByLabel("Import source JSON")
    .setInputFiles({
      name: "changed-source.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(batch)),
    });
  await expect(page.getByRole("status")).toContainText("672");
  await page.getByRole("button", { name: "Approvals", exact: true }).click();
  await expect(
    page.getByText(/older actions need a fresh analysis/),
  ).toBeVisible();
  await page.getByRole("button", { name: "AI analyst", exact: true }).click();
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Analysis complete");
  await page.getByRole("button", { name: "Approvals", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review action" }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
