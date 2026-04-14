import { defineConfig } from "cypress";

export default defineConfig({
  projectId: "z85gcg",
  allowCypressEnv: false,

  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    excludeSpecPattern: [
      "cypress/e2e/1-getting-started/**",
      "cypress/e2e/2-advanced-examples/**",
    ],
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },

  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
  },
});
