import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "./types.js";

export const readTool: Tool = {
  name: "read",
  description: "Read and return the contents of a file.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file (relative to project root)" },
    },
    required: ["path"],
  },

  async execute(input, ctx) {
    const path = input.path;
    if (typeof path !== "string" || !path) {
      return { content: "Error: path is required", isError: true };
    }

    const filePath = resolve(ctx.cwd, path);
    try {
      const content = await readFile(filePath, "utf-8");
      return { content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Error reading ${path}: ${msg}`, isError: true };
    }
  },
};
