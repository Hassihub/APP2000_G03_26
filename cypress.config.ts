import { defineConfig } from "cypress";

export default defineConfig({
  projectId: "z85gcg",
  allowCypressEnv: false,
  reporter: "cypress-mochawesome-reporter",
  reporterOptions: {
    charts: true,
    reportPageTitle: "FritFram Tests",
    embeddedScreenshots: true,
    inlineAssets: true,
  },
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1280,
    viewportHeight: 800,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    excludeSpecPattern: [
      "cypress/e2e/1-getting-started/**",
      "cypress/e2e/2-advanced-examples/**",
    ],
    setupNodeEvents(on, config) {
      require("cypress-mochawesome-reporter/plugin")(on);
    },
  },
  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
  },
});
