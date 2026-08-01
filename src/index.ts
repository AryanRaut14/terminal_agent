#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import "dotenv/config";

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

async function runSingleTask(task: string, _opts: CliOptions): Promise<void> {
  console.log(`[echo] ${task}`);
}

async function runRepl(_opts: CliOptions): Promise<void> {
  const rl = createInterface({ input, output });
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

      console.log(`[echo] ${trimmed}`);
    }
  } finally {
    rl.close();
  }
}

program.parse();
