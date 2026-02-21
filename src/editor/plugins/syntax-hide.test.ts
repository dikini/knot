import { describe, it, expect } from "vitest";
import { syntaxHidePlugin } from "./syntax-hide";

describe("syntaxHidePlugin WYSIWYM behavior", () => {
  it("does not inject custom heading prefix node view", () => {
    const plugin = syntaxHidePlugin();

    expect(plugin.props.nodeViews?.heading).toBeUndefined();
  });
});
