#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import "dotenv/config";
import { runAgentLoop } from "./agent-loop.js";
import { loadAllTools } from "./extensions.js";
import type { Message } from "./providers/index.js";
import {
  appendTurn,
  branchTo,
  createSession,
  formatSessionTree,
  getBranchHistory,
  loadSession,
  saveSession,
  type Session,
} from "./session.js";
import { coreTools, type Tool } from "./tools/index.js";

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
    const { tools, warnings } = await loadAllTools(process.cwd(), coreTools);
    for (const warning of warnings) {
      console.error(`Warning: ${warning}`);
    }
    if (tools.length > coreTools.length) {
      const names = tools
        .filter((t) => !coreTools.some((c) => c.name === t.name))
        .map((t) => t.name);
      console.error(`Loaded extension tools: ${names.join(", ")}\n`);
    }

    if (task) {
      await runSingleTask(task, opts, tools);
    } else {
      await runRepl(opts, tools);
    }
  });

interface CliOptions {
  confirm?: boolean;
  model?: string;
  provider: string;
  verbose?: boolean;
  resume?: string;
}

function loopOptions(opts: CliOptions, tools: Tool[]) {
  return {
    provider: opts.provider,
    model: opts.model,
    confirm: opts.confirm,
    verbose: opts.verbose,
    tools,
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

async function initSession(opts: CliOptions): Promise<Session> {
  if (opts.resume) {
    const session = await loadSession(process.cwd(), opts.resume);
    console.error(`Resumed session ${session.id} (active node ${session.activeNodeId.slice(0, 8)})\n`);
    return session;
  }

  const session = createSession({
    cwd: process.cwd(),
    provider: opts.provider,
    model: opts.model,
  });
  await saveSession(session);
  console.error(`New session ${session.id}\n`);
  return session;
}

function turnDelta(before: Message[], after: Message[]): Message[] {
  return after.slice(before.length);
}

async function runTurn(
  userMessage: string,
  session: Session,
  opts: CliOptions,
  tools: Tool[]
): Promise<{ reply: string; session: Session }> {
  const history = getBranchHistory(session);
  const { reply, history: updated } = await runAgentLoop(
    userMessage,
    history,
    loopOptions(opts, tools)
  );
  const delta = turnDelta(history, updated);
  appendTurn(session, delta);
  await saveSession(session);
  return { reply, session };
}

async function runSingleTask(
  task: string,
  opts: CliOptions,
  tools: Tool[]
): Promise<void> {
  if (opts.resume) {
    const session = await initSession(opts);
    const { reply } = await runTurn(task, session, opts, tools);
    console.log(reply);
    return;
  }

  const { reply } = await runAgentLoop(task, [], loopOptions(opts, tools));
  console.log(reply);
}

function handleReplCommand(line: string, session: Session): string | null {
  const trimmed = line.trim();

  if (trimmed === "/tree") {
    console.log(formatSessionTree(session));
    return null;
  }

  if (trimmed === "/session") {
    console.log(`session: ${session.id}`);
    console.log(`active:  ${session.activeNodeId}`);
    console.log(`nodes:   ${Object.keys(session.nodes).length}`);
    return null;
  }

  if (trimmed.startsWith("/branch ")) {
    const nodeId = trimmed.slice("/branch ".length).trim();
    if (!nodeId) {
      console.error("Usage: /branch <node-id>");
      return null;
    }

    const match = Object.keys(session.nodes).find(
      (id) => id === nodeId || id.startsWith(nodeId)
    );
    if (!match) {
      console.error(`Unknown node "${nodeId}"`);
      return null;
    }

    branchTo(session, match);
    console.log(`Branched to node ${match.slice(0, 8)} — next message starts a new path.`);
    return null;
  }

  if (trimmed === "/help") {
    console.log(`Commands:
  /tree              Show session tree
  /session           Show session info
  /branch <node-id>  Branch from an earlier node (prefix match ok)
  /help              Show this help
  exit, quit         Exit`);
    return null;
  }

  return trimmed;
}

async function runRepl(opts: CliOptions, tools: Tool[]): Promise<void> {
  const rl = createInterface({ input, output });
  let session = await initSession(opts);

  console.log("pi-clone — interactive mode (type 'exit' or Ctrl+C to quit, /help for commands)\n");

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

      if (trimmed.startsWith("/")) {
        handleReplCommand(trimmed, session);
        if (trimmed.startsWith("/branch ")) {
          await saveSession(session);
        }
        continue;
      }

      try {
        const result = await runTurn(trimmed, session, opts, tools);
        session = result.session;
        console.log(`\n${result.reply}\n`);
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
