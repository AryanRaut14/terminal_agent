import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Tool } from "./types.js";

export const writeTool: Tool = {
  name: "write",
  description: "Create a new file or overwrite an existing file.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file (relative to project root)" },
      content: { type: "string", description: "Full file contents to write" },
    },
    required: ["path", "content"],
  },

  async execute(input, ctx) {
    const path = input.path;
    const content = input.content;
    if (typeof path !== "string" || !path) {
      return { content: "Error: path is required", isError: true };
    }
    if (typeof content !== "string") {
      return { content: "Error: content is required", isError: true };
    }

    const filePath = resolve(ctx.cwd, path);
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");
      return { content: `Wrote ${path} (${content.length} bytes)` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Error writing ${path}: ${msg}`, isError: true };
    }
  },
};
