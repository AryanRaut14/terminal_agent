#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import "dotenv/config";
import { runAgentLoop } from "./agent-loop.js";
import type { Message } from "./providers/index.js";

const program = new Command();

program
  .name("agent")
  .description("A lean, extensible terminal-based coding agent")
  .argument("[task]", "Run a single task non-interactively and exit")
  .option("--confirm", "Prompt before write/edit/bash operations")
  .option("--model <name>", "Model name")
  .option(
    "--provider <name>",
    "LLM provider (anthropic|openai|groq|gemini)",
    "anthropic"
  )
  .option("--verbose", "Show raw tool calls")
  .option("--resume <session-id>", "Resume an existing session")
  .action(async (task: string | undefined, opts) => {
    if (task) {
      await runSingleTask(task, opts);
    } else {
      await runRepl(opts);
    }
  });

interface CliOptions {
  confirm?: boolean;
  model?: string;
  provider: string;
  verbose?: boolean;
  resume?: string;
}

function loopOptions(opts: CliOptions) {
  return {
    provider: opts.provider,
    model: opts.model,
    confirm: opts.confirm,
    verbose: opts.verbose,
    onToolCall: (name: string, toolInput: Record<string, unknown>) => {
      console.error(`\n→ ${name}(${JSON.stringify(toolInput)})\n`);
    },
    onToolResult: (name: string, content: string) => {
      const preview =
        content.length > 500 ? content.slice(0, 500) + "\n...(truncated)" : content;
      console.error(`← ${name}:\n${preview}\n`);
    },
  };
}

async function runSingleTask(task: string, opts: CliOptions): Promise<void> {
  const { reply } = await runAgentLoop(task, [], loopOptions(opts));
  console.log(reply);
}

async function runRepl(opts: CliOptions): Promise<void> {
  const rl = createInterface({ input, output });
  let history: Message[] = [];

  console.log("pi-clone — interactive mode (type 'exit' or Ctrl+C to quit)\n");

  try {
    while (true) {
      const line = await rl.question("> ");
      const trimmed = line.trim();

      if (trimmed === "exit" || trimmed === "quit") {
        break;
      }
      if (trimmed === "") {
        continue;
      }

      try {
        const { reply, history: updated } = await runAgentLoop(
          trimmed,
          history,
          loopOptions(opts)
        );
        history = updated;
        console.log(`\n${reply}\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\nError: ${msg}\n`);
      }
    }
  } finally {
    rl.close();
  }
}

program.parse();
