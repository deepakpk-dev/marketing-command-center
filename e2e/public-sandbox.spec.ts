import { test, expect } from "@playwright/test";
const csv =
  "Campaign ID,Campaign,Day,Cost,Currency code,Impressions,Clicks,Conversions,Conv. value\n99,My uploaded campaign,2026-09-01,25,USD,1000,20,2,80";
test("sample visitors review evidence, record a simulated decision and export without private API calls", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore sample data", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Performance overview" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample data · Sandbox", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review the evidence" }).click();
  await expect(
    page.getByRole("heading", { name: "Campaign evidence" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Campaign evidence" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "View recommendation" }).click();
  await page.getByRole("button", { name: "Review decision" }).first().click();
  await page
    .getByLabel("Decision note")
    .fill("Check tracking before changing spend.");
  await page.getByRole("button", { name: "Approve simulation" }).click();
  await expect(
    page.getByText("Check tracking before changing spend.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Upload another report", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose new report", exact: true })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByText("Check tracking before changing spend.", { exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report" }).click();
  expect((await downloaded).suggestedFilename()).toContain("signal-");
  expect(apiRequests).toEqual([]);
});
test("upload preview leads to only the user's report with original currency", async ({
  page,
  context,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload my report", exact: true })
    .click();
  await page.getByLabel("Choose CSV report").setInputFiles({
    name: "google.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByRole("heading", { name: "Check your report" }),
  ).toBeVisible();
  await expect(page.getByText("USD", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "View my insights" }).click();
  await expect(
    page.getByText("My uploaded campaign", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sandbox-metrics")).toContainText("US$25");
  await expect(
    page.getByText("Prospecting | Broad", { exact: true }),
  ).not.toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await expect(
    otherTab.getByRole("button", { name: "Explore sample data", exact: true }),
  ).toBeVisible();
  await expect(
    otherTab.getByText("My uploaded campaign", { exact: true }),
  ).not.toBeVisible();
  await otherTab.close();
  expect(apiRequests).toEqual([]);
  await page
    .getByRole("button", { name: "Clear my data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear sandbox", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "See what your marketing data is telling you.",
    }),
  ).toBeVisible();
});
test("unfamiliar columns have an actionable mapping flow", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload my report", exact: true })
    .click();
  await page.getByLabel("Choose CSV report").setInputFiles({
    name: "custom.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "identifier,title,date,money,views,visits\na,Custom campaign,2026-09-01,25,1000,20",
    ),
  });
  await page.getByLabel("Report source").selectOption("google");
  await page.getByLabel("Report currency").fill("GBP");
  for (const [label, column] of [
    ["Campaign ID *", "identifier"],
    ["Campaign name *", "title"],
    ["Spend *", "money"],
    ["Impressions *", "views"],
    ["Clicks *", "visits"],
  ]) {
    await page
      .getByRole("combobox", { name: label, exact: true })
      .selectOption(column);
  }
  await page.getByRole("button", { name: "View my insights" }).click();
  await expect(
    page.getByText("Custom campaign", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sandbox-metrics")).toContainText("£25");
});
test("campaign evidence leads to that campaign's recommendation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore sample data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect Prospecting | Broad", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View recommendation", exact: true })
    .click();
  await expect(page.locator(".sandbox-insights article h2").first()).toHaveText(
    "Review Prospecting | Broad",
  );
});
test("invalid report stays in preview and explains the row to fix", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload my report", exact: true })
    .click();
  await page.getByLabel("Choose CSV report").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv.replace("2026-09-01", "2026-02-30")),
  });
  await expect(page.locator(".import-errors[role=alert]")).toContainText(
    "Row 2",
  );
  await expect(
    page.getByRole("button", { name: "View my insights" }),
  ).toBeDisabled();
});
test("missing revenue is unavailable instead of fictional ROAS", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Upload my report", exact: true })
    .click();
  await page.getByLabel("Choose CSV report").setInputFiles({
    name: "meta.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Campaign ID,Campaign name,Reporting starts,Reporting ends,Amount spent (USD),Impressions,Clicks (all)\n2,My Meta campaign,2026-09-01,2026-09-01,25,1000,20",
    ),
  });
  await page.getByRole("button", { name: "View my insights" }).click();
  await expect(page.locator(".sandbox-metrics")).toContainText("Unavailable");
  await expect(
    page.getByText("Revenue is missing", { exact: true }),
  ).toBeVisible();
});
test("public sandbox clears on refresh and mobile navigation is accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore sample data", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".sandbox-sidebar nav")
      .evaluate((nav) => nav.scrollWidth <= nav.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your insights" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Explore sample data", exact: true }),
  ).toBeVisible();
});
