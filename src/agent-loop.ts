import { createProvider, type ContentBlock, type Message, type Provider } from "./providers/index.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import {
  coreTools,
  executeToolCall,
  getToolDefinitions,
  type Tool,
} from "./tools/index.js";

const MAX_TOOL_ITERATIONS = 50;

export interface AgentLoopOptions {
  provider: string;
  model?: string;
  cwd?: string;
  confirm?: boolean;
  verbose?: boolean;
  tools?: Tool[];
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, content: string, isError?: boolean) => void;
}

export interface AgentLoopResult {
  reply: string;
  history: Message[];
}

function buildAssistantContent(
  text: string,
  toolCalls: { id: string; name: string; input: Record<string, unknown> }[]
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (text) blocks.push({ type: "text", text });
  for (const call of toolCalls) {
    blocks.push({
      type: "tool_use",
      id: call.id,
      name: call.name,
      input: call.input,
    });
  }
  return blocks;
}

export async function runAgentLoop(
  userMessage: string,
  history: Message[],
  options: AgentLoopOptions
): Promise<AgentLoopResult> {
  const provider: Provider = createProvider(options.provider);
  const tools = options.tools ?? coreTools;
  const toolDefs = getToolDefinitions(tools);
  const cwd = options.cwd ?? process.cwd();
  const ctx = { cwd, confirm: options.confirm };

  let messages: Message[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let reply = "";
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await provider.sendMessage({
      systemPrompt: SYSTEM_PROMPT,
      messages,
      tools: toolDefs,
      model: options.model,
    });

    const assistantBlocks = buildAssistantContent(response.text, response.toolCalls);
    messages.push({ role: "assistant", content: assistantBlocks });

    if (response.toolCalls.length === 0) {
      reply = response.text;
      break;
    }

    if (options.verbose) {
      console.error(JSON.stringify({ toolCalls: response.toolCalls }, null, 2));
    }

    const resultBlocks: ContentBlock[] = [];
    for (const call of response.toolCalls) {
      options.onToolCall?.(call.name, call.input);
      const result = await executeToolCall(call, tools, ctx);
      options.onToolResult?.(call.name, result.content, result.isError);
      resultBlocks.push({
        type: "tool_result",
        toolUseId: call.id,
        content: result.content,
        isError: result.isError,
      });
    }

    messages.push({ role: "user", content: resultBlocks });

    if (response.stopReason === "end_turn" && response.toolCalls.length === 0) {
      reply = response.text;
      break;
    }
  }

  if (iterations >= MAX_TOOL_ITERATIONS) {
    throw new Error(`Agent stopped after ${MAX_TOOL_ITERATIONS} tool iterations`);
  }

  return { reply, history: messages };
}
