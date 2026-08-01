import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Tool, ToolContext, ToolResult } from "./tools/types.js";

const EXTENSIONS_DIR = ".pi-clone/extensions";
const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".mjs"]);

/** Shape expected from an extension module export. */
export interface ExtensionToolExport {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (
    input: Record<string, unknown>,
    ctx: ToolContext
  ) => Promise<ToolResult> | ToolResult;
}

export interface LoadExtensionsResult {
  tools: Tool[];
  warnings: string[];
}

let tsxRegistered = false;

async function importExtensionModule(filePath: string): Promise<Record<string, unknown>> {
  const ext = extname(filePath);
  if (ext === ".ts") {
    if (!tsxRegistered) {
      const { register } = await import("tsx/esm/api");
      register();
      tsxRegistered = true;
    }
  }

  const mod = await import(pathToFileURL(filePath).href);
  return mod as Record<string, unknown>;
}

function normalizeExtension(
  raw: unknown,
  fileName: string
): { tool?: Tool; error?: string } {
  const ext = raw as Partial<ExtensionToolExport>;

  if (!ext.name || typeof ext.name !== "string") {
    return { error: `${fileName}: missing string "name"` };
  }
  if (!ext.description || typeof ext.description !== "string") {
    return { error: `${fileName}: missing string "description"` };
  }
  if (!ext.inputSchema || typeof ext.inputSchema !== "object") {
    return { error: `${fileName}: missing "inputSchema" object` };
  }
  if (ext.inputSchema.type !== "object") {
    return { error: `${fileName}: inputSchema.type must be "object"` };
  }
  if (typeof ext.execute !== "function") {
    return { error: `${fileName}: missing "execute" function` };
  }

  const tool: Tool = {
    name: ext.name,
    description: ext.description,
    inputSchema: {
      type: "object",
      properties: ext.inputSchema.properties ?? {},
      required: ext.inputSchema.required ?? [],
    },
    async execute(input, ctx) {
      return await ext.execute!(input, ctx);
    },
  };

  return { tool };
}

export function getExtensionsDir(cwd: string = process.cwd()): string {
  return join(cwd, EXTENSIONS_DIR);
}

/** Load extension tools from .pi-clone/extensions/*.ts|.js|.mjs */
export async function loadExtensions(
  cwd: string = process.cwd()
): Promise<LoadExtensionsResult> {
  const dir = getExtensionsDir(cwd);
  const tools: Tool[] = [];
  const warnings: string[] = [];

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return { tools, warnings };
  }

  for (const file of files.sort()) {
    const filePath = join(dir, file);
    const ext = extname(file);
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    try {
      const mod = await importExtensionModule(filePath);
      const raw = mod.default ?? mod.tool;
      if (!raw) {
        warnings.push(`${file}: no default or named "tool" export — skipped`);
        continue;
      }

      const { tool, error } = normalizeExtension(raw, file);
      if (error) {
        warnings.push(error);
        continue;
      }
      if (tool) tools.push(tool);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`${file}: failed to load (${msg})`);
    }
  }

  return { tools, warnings };
}

export async function loadAllTools(
  cwd: string = process.cwd(),
  coreTools: Tool[]
): Promise<{ tools: Tool[]; warnings: string[] }> {
  const { tools: extensions, warnings } = await loadExtensions(cwd);
  const coreNames = new Set(coreTools.map((t) => t.name));
  const merged = [...coreTools];

  for (const tool of extensions) {
    if (coreNames.has(tool.name)) {
      warnings.push(
        `Extension tool "${tool.name}" conflicts with a core tool — skipped`
      );
      continue;
    }
    if (merged.some((t) => t.name === tool.name)) {
      warnings.push(`Duplicate extension tool "${tool.name}" — skipped`);
      continue;
    }
    merged.push(tool);
  }

  return { tools: merged, warnings };
}
