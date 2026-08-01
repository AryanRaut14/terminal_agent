import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

export const bashTool: Tool = {
  name: "bash",
  description:
    "Execute a shell command in the project directory. Returns stdout, stderr, and exit code.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to run" },
    },
    required: ["command"],
  },

  async execute(input, ctx) {
    const command = input.command;
    if (typeof command !== "string" || !command) {
      return { content: "Error: command is required", isError: true };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: ctx.cwd,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });

      const parts: string[] = ["exit code: 0"];
      if (stdout) parts.push(`stdout:\n${stdout}`);
      if (stderr) parts.push(`stderr:\n${stderr}`);
      return { content: parts.join("\n\n") };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      const exitCode = execErr.code ?? 1;
      const parts: string[] = [`exit code: ${exitCode}`];
      if (execErr.stdout) parts.push(`stdout:\n${execErr.stdout}`);
      if (execErr.stderr) parts.push(`stderr:\n${execErr.stderr}`);
      if (!execErr.stdout && !execErr.stderr && execErr.message) {
        parts.push(`error: ${execErr.message}`);
      }
      return { content: parts.join("\n\n"), isError: exitCode !== 0 };
    }
  },
};
