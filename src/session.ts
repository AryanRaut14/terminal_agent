import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Message } from "./providers/types.js";

export interface SessionNode {
  id: string;
  parentId: string | null;
  /** Messages added during this turn (user, assistant, tool results). */
  messages: Message[];
  createdAt: string;
}

export interface Session {
  id: string;
  cwd: string;
  provider: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  activeNodeId: string;
  nodes: Record<string, SessionNode>;
}

export interface SessionSummary {
  id: string;
  cwd: string;
  updatedAt: string;
  nodeCount: number;
}

const SESSIONS_DIR = ".pi-clone/sessions";

export function getSessionsDir(cwd: string = process.cwd()): string {
  return join(cwd, SESSIONS_DIR);
}

function sessionPath(cwd: string, sessionId: string): string {
  return join(getSessionsDir(cwd), `${sessionId}.json`);
}

export function createSession(options: {
  cwd?: string;
  provider: string;
  model?: string;
}): Session {
  const cwd = options.cwd ?? process.cwd();
  const now = new Date().toISOString();
  const rootId = randomUUID();

  return {
    id: randomUUID(),
    cwd,
    provider: options.provider,
    model: options.model,
    createdAt: now,
    updatedAt: now,
    activeNodeId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        parentId: null,
        messages: [],
        createdAt: now,
      },
    },
  };
}

export async function saveSession(session: Session): Promise<void> {
  session.updatedAt = new Date().toISOString();
  const dir = getSessionsDir(session.cwd);
  await mkdir(dir, { recursive: true });
  await writeFile(sessionPath(session.cwd, session.id), JSON.stringify(session, null, 2), "utf-8");
}

export async function loadSession(cwd: string, sessionId: string): Promise<Session> {
  const raw = await readFile(sessionPath(cwd, sessionId), "utf-8");
  return JSON.parse(raw) as Session;
}

export async function listSessions(cwd: string = process.cwd()): Promise<SessionSummary[]> {
  const dir = getSessionsDir(cwd);
  try {
    const files = await readdir(dir);
    const summaries: SessionSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const session = await loadSession(cwd, file.replace(/\.json$/, ""));
        summaries.push({
          id: session.id,
          cwd: session.cwd,
          updatedAt: session.updatedAt,
          nodeCount: Object.keys(session.nodes).length,
        });
      } catch {
        // skip corrupt files
      }
    }

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/** Walk from root to nodeId, concatenating messages in order. */
export function getBranchHistory(session: Session, nodeId?: string): Message[] {
  const targetId = nodeId ?? session.activeNodeId;
  const chain: SessionNode[] = [];
  let current: SessionNode | undefined = session.nodes[targetId];

  while (current) {
    chain.push(current);
    current = current.parentId ? session.nodes[current.parentId] : undefined;
  }

  chain.reverse();
  return chain.flatMap((node) => node.messages);
}

/** Append a turn as a new child of the active node. Returns the new active node id. */
export function appendTurn(session: Session, messages: Message[]): string {
  const now = new Date().toISOString();
  const nodeId = randomUUID();
  const parentId = session.activeNodeId;

  session.nodes[nodeId] = {
    id: nodeId,
    parentId,
    messages,
    createdAt: now,
  };
  session.activeNodeId = nodeId;
  return nodeId;
}

/** Set active node so the next turn branches from an earlier point. */
export function branchTo(session: Session, nodeId: string): void {
  if (!session.nodes[nodeId]) {
    throw new Error(`Unknown session node "${nodeId}"`);
  }
  session.activeNodeId = nodeId;
}

export interface TreeLine {
  nodeId: string;
  depth: number;
  messageCount: number;
  preview: string;
  isActive: boolean;
}

/** List nodes for display (depth-first from root). */
export function getSessionTree(session: Session): TreeLine[] {
  const root = Object.values(session.nodes).find((n) => n.parentId === null);
  if (!root) return [];

  const lines: TreeLine[] = [];

  function walk(node: SessionNode, depth: number): void {
    const firstUser = node.messages.find((m) => m.role === "user");
    let preview = "(root)";
    if (firstUser) {
      const text =
        typeof firstUser.content === "string"
          ? firstUser.content
          : firstUser.content.find((b) => b.type === "text")?.text ?? "(tool turn)";
      preview = text.replace(/\s+/g, " ").slice(0, 60);
    }

    lines.push({
      nodeId: node.id,
      depth,
      messageCount: node.messages.length,
      preview,
      isActive: node.id === session.activeNodeId,
    });

    const children = Object.values(session.nodes)
      .filter((n) => n.parentId === node.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const child of children) {
      walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return lines;
}

export function formatSessionTree(session: Session): string {
  const lines = getSessionTree(session);
  return lines
    .map((line) => {
      const indent = "  ".repeat(line.depth);
      const marker = line.isActive ? " *" : "";
      const shortId = line.nodeId.slice(0, 8);
      return `${indent}${shortId}  ${line.preview}${marker}`;
    })
    .join("\n");
}
