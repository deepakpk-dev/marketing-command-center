import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const url = process.env.PREVIEW_URL || "http://127.0.0.1:3000";
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Explore sample data", exact: true }).waitFor();
  await page.screenshot({ path: "output/playwright/welcome.png", fullPage: true });
  await page.getByRole("button", { name: "Upload my report", exact: true }).click();
  await page.screenshot({ path: "output/playwright/upload.png", fullPage: true });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Explore sample data", exact: true }).click();
  await page.getByRole("heading", { name: "Performance overview" }).waitFor();
  await page.screenshot({
    path: "output/playwright/overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/analyst.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Decisions", exact: true }).click();
  await page.getByRole("button", { name: "Review decision" }).first().click();
  await page.screenshot({
    path: "output/playwright/approvals.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/mobile.png",
    fullPage: true,
  });
  console.log("Captured welcome, upload, overview, insights, decisions and mobile previews.");
} finally {
  await browser.close();
}
