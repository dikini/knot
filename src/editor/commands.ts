import { setBlockType } from "prosemirror-commands";
import type { Command } from "prosemirror-state";
import { schema } from "./schema";

// SPEC: COMP-AUTHORING-FLOWS-001 FR-7, FR-8
export const clearBlockFormatting: Command = (state, dispatch, view) => {
  const paragraph = schema.nodes.paragraph;
  return setBlockType(paragraph)(state, dispatch, view);
};
