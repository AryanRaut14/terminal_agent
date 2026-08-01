import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "./types.js";

export const editTool: Tool = {
  name: "edit",
  description:
    "Replace a unique string in a file. Fails if old_str is not found or appears more than once.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file (relative to project root)" },
      old_str: { type: "string", description: "Exact string to find (must be unique in the file)" },
      new_str: { type: "string", description: "Replacement string" },
    },
    required: ["path", "old_str", "new_str"],
  },

  async execute(input, ctx) {
    const path = input.path;
    const oldStr = input.old_str;
    const newStr = input.new_str;

    if (typeof path !== "string" || !path) {
      return { content: "Error: path is required", isError: true };
    }
    if (typeof oldStr !== "string") {
      return { content: "Error: old_str is required", isError: true };
    }
    if (typeof newStr !== "string") {
      return { content: "Error: new_str is required", isError: true };
    }

    const filePath = resolve(ctx.cwd, path);
    let fileContent: string;
    try {
      fileContent = await readFile(filePath, "utf-8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Error reading ${path}: ${msg}`, isError: true };
    }

    const firstIndex = fileContent.indexOf(oldStr);
    if (firstIndex === -1) {
      return {
        content: `Error: old_str not found in ${path}`,
        isError: true,
      };
    }

    const secondIndex = fileContent.indexOf(oldStr, firstIndex + oldStr.length);
    if (secondIndex !== -1) {
      return {
        content: `Error: old_str is not unique in ${path} (found multiple occurrences)`,
        isError: true,
      };
    }

    const updated =
      fileContent.slice(0, firstIndex) + newStr + fileContent.slice(firstIndex + oldStr.length);

    try {
      await writeFile(filePath, updated, "utf-8");
      return { content: `Edited ${path}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Error writing ${path}: ${msg}`, isError: true };
    }
  },
};
