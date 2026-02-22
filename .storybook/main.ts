import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    const alias = {
      "@": path.resolve(rootDir, "src"),
      "@components": path.resolve(rootDir, "src/components"),
      "@editor": path.resolve(rootDir, "src/editor"),
      "@hooks": path.resolve(rootDir, "src/hooks"),
      "@lib": path.resolve(rootDir, "src/lib"),
      "@types": path.resolve(rootDir, "src/types"),
    };

    return {
      ...config,
      resolve: {
        ...(config.resolve ?? {}),
        alias: {
          ...(config.resolve?.alias ?? {}),
          ...alias,
        },
      },
    };
  },
};

export default config;
