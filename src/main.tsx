import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { signalFrontendReady } from "@lib/windowControls";
import "@benrbray/prosemirror-math/dist/prosemirror-math.css";
import "katex/dist/katex.min.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

void (async () => {
  try {
    await signalFrontendReady();
  } catch {
    // Ignore startup signal failures; backend has a fallback timer.
  }
})();
