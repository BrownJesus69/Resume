// Playwright config for the end-to-end suite: `npm run test:e2e`
const path = require("path");
const PORT = 8317;

module.exports = {
  testDir: __dirname,
  testMatch: /.*\.spec\.cjs/,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  outputDir: path.join(__dirname, "..", "test-results"),
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    acceptDownloads: true,
    trace: "retain-on-failure",
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {})
  },
  webServer: {
    command: `node ${path.join(__dirname, "serve.cjs")} ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1400, height: 900 } } },
    { name: "mobile",  use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
};
