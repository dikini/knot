import type { Preview } from "@storybook/react-vite";
import { sb } from "storybook/test";
import "../src/styles/global.css";
import "../src/styles/App.css";

sb.mock(import("../src/lib/api.ts"), { spy: true });
sb.mock(import("@tauri-apps/api/event"), { spy: true });

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
      test: "todo",
    },
  },
  tags: ["autodocs"],
};

export default preview;
