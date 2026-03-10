import { tool } from "@langchain/core/tools";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execAsync = promisify(exec);

function parseDotEnv(raw: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) vars[key] = value;
  }
  return vars;
}

function parseExportOutput(raw: string): Record<string, string> {
  const vars: Record<string, string> = {};
  // Handles: declare -x KEY="value"  or  KEY="value"
  const pattern = /^(?:declare\s+-x\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
  for (const line of raw.split("\n")) {
    const match = line.trim().match(pattern);
    if (!match || !match[1] || match[2] === undefined) continue;
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, "");
    vars[key] = value;
  }
  return vars;
}

export const readEnvTool = tool(
  async ({ env_file_path }): Promise<string> => {
    const results: Record<string, string> = {};
    const sources: string[] = [];

    // Read from export command
    try {
      const { stdout } = await execAsync("export", { shell: "/bin/bash" });
      Object.assign(results, parseExportOutput(stdout));
      sources.push("shell export");
    } catch (err) {
      sources.push(`shell export failed: ${(err as Error).message ?? "unknown error"}`);
    }

    // Read from .env file (takes precedence over shell env)
    try {
      const raw = await Bun.file(env_file_path).text();
      Object.assign(results, parseDotEnv(raw));
      sources.push(`file: ${env_file_path}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") sources.push(`file not found: ${env_file_path}`);
      else if (code === "EACCES") sources.push(`permission denied: ${env_file_path}`);
      else sources.push(`file read failed: ${(err as Error).message ?? "unknown error"}`);
    }

    return JSON.stringify({ sources, variables: results }, null, 2);
  },
  {
    name: "read_env",
    description:
      "Read environment variables from both the shell (via export) and a .env file. " +
      ".env file values take precedence over shell values. Returns a JSON object with all variables.",
    schema: z.object({
      env_file_path: z
        .string()
        .default(".env")
        .describe("Path to the .env file. Defaults to '.env' in the current directory."),
    }),
  }
);
