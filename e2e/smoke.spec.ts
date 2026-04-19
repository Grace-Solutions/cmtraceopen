import { test, expect } from "./fixtures";

test.describe("App smoke tests", () => {
  test("app loads at :1420 without JS errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/");
    // Wait for the splash screen to dismiss (React has mounted and called dismissSplash)
    await page.waitForSelector("#splash", { state: "detached", timeout: 10_000 });

    // Filter out known benign errors (e.g. HMR websocket in CI, bridge probe when not running)
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes("WebSocket") &&
        !e.includes("ws://") &&
        !e.includes("ERR_CONNECTION_REFUSED") // bridge probe fails gracefully when Tauri app is not running
    );
    expect(realErrors, `Unexpected JS errors:\n${realErrors.join("\n")}`).toHaveLength(0);
  });

  test("toolbar is rendered with open button", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#splash", { state: "detached", timeout: 10_000 });
    // The "Open..." button is always visible in the toolbar
    await expect(page.getByRole("button", { name: /Open/ })).toBeVisible({ timeout: 10_000 });
  });

  test("workspace selector shows Log Explorer", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#splash", { state: "detached", timeout: 10_000 });
    // Fluent UI Dropdown renders as role="combobox" with aria-label from the surrounding label element
    await expect(page.getByRole("combobox", { name: "Workspace" })).toBeVisible({ timeout: 10_000 });
  });

  test("log view is the default active view", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#splash", { state: "detached", timeout: 10_000 });
    // The status bar always shows the active workspace label
    await expect(page.getByText(/Log view/)).toBeVisible({ timeout: 10_000 });
  });

  test("page title is set", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
  });
});
