import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SkillSummary {
  name: string;
  description: string;
  path: string;
}

const SKILLS_DIR = ".pi-clone/skills";

function parseSkillMetadata(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return {};

  const metadata: { name?: string; description?: string } = {};
  for (const line of match[1].split(/\r?\n/)) {
    const [key, ...rest] = line.split(":");
    if (!key || !rest.length) continue;
    const value = rest.join(":").trim();
    if (key.trim() === "name") metadata.name = value;
    if (key.trim() === "description") metadata.description = value;
  }
  return metadata;
}

export async function loadSkills(cwd: string = process.cwd()): Promise<SkillSummary[]> {
  const dir = join(cwd, SKILLS_DIR);
  try {
    const files = await readdir(dir);
    const skills: SkillSummary[] = [];

    for (const file of files.sort()) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(dir, file);
      const content = await readFile(filePath, "utf-8");
      const metadata = parseSkillMetadata(content);
      skills.push({
        name: metadata.name ?? file.replace(/\.md$/, ""),
        description: metadata.description ?? "Reference documentation",
        path: filePath,
      });
    }

    return skills;
  } catch {
    return [];
  }
}
