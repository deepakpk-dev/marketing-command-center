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
  await page.getByRole("button", { name: "Sync sample data" }).waitFor();
  await page
    .getByRole("button", { name: "View Search | Brand performance" })
    .waitFor({ timeout: 45000 });
  await page.screenshot({
    path: "output/playwright/overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "AI analyst", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/analyst.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Approvals", exact: true }).click();
  await page.getByRole("button", { name: "Review action" }).first().click();
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
  console.log("Captured overview, analyst, approvals, and mobile previews.");
} finally {
  await browser.close();
}
