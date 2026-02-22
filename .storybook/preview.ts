import type { Preview } from "@storybook/react-vite";
import "../src/styles/global.css";
import "../src/styles/App.css";

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

