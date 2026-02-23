import type { Preview } from "@storybook/react-vite";
import { sb } from "storybook/test";
import "../src/styles/global.css";
import "../src/styles/App.css";

sb.mock(import("../src/lib/api.ts"), { spy: true });
sb.mock(import("@tauri-apps/api/event"), { spy: true });

const strictA11y =
  (typeof process !== "undefined" && process.env?.STORYBOOK_A11Y_STRICT === "1") ||
  (typeof globalThis !== "undefined" &&
    (Reflect.get(globalThis, "STORYBOOK_A11Y_STRICT") === "1" ||
      Reflect.get(globalThis, "STORYBOOK_A11Y_STRICT") === 1));

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Set STORYBOOK_A11Y_STRICT=1 to fail Storybook Vitest runs on a11y violations.
      test: strictA11y ? "error" : "todo",
    },
  },
  tags: ["autodocs"],
};

export default preview;
