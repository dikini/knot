import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          globals: true,
          environment: "happy-dom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "json-summary", "html"],
            exclude: [
              "node_modules/",
              "**/*.css",
              "src/test/",
              "**/*.stories.ts",
              "**/*.stories.tsx",
              "**/*.test.ts",
              "**/*.test.tsx",
              "**/*.spec.ts",
              "**/*.spec.tsx",
            ],
          },
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "json-summary", "html"],
            exclude: [
              "node_modules/",
              "**/*.css",
              "src/test/",
              "**/*.stories.ts",
              "**/*.stories.tsx",
              "**/*.test.ts",
              "**/*.test.tsx",
              "**/*.spec.ts",
              "**/*.spec.tsx",
            ],
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@editor": path.resolve(__dirname, "./src/editor"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
});
