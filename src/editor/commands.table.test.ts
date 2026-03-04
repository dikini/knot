import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { tableEditingKey } from "prosemirror-tables";
import { plugins } from "./plugins";
import { schema } from "./schema";
import { insertTable } from "./commands";

const editorConfig = {
  hideInactiveSyntax: false,
  mediaEmbed: true,
  wikilinks: true,
  theme: "dark" as const,
  fontSize: 16,
  lineHeight: 1.6,
};

describe("table editing wiring", () => {
  it("registers the prosemirror tableEditing plugin", () => {
    const pluginKeys = plugins(editorConfig)
      .map((plugin) => plugin.spec?.key)
      .filter(Boolean);

    expect(pluginKeys).toContain(tableEditingKey);
  });

  it("insertTable command inserts a table document node", () => {
    let state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Intro")])]),
    });

    const handled = insertTable(state, (tr) => {
      state = state.apply(tr);
    });

    expect(handled).toBe(true);
    expect(state.doc.child(0)?.type.name).toBe("table");
    expect(state.doc.child(0)?.childCount).toBeGreaterThan(0);
    expect(state.doc.child(1)?.type.name).toBe("paragraph");
  });
});
