import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const readFileTool = tool(
  async ({ file_path }): Promise<string> => {
    try {
      const content = await Bun.file(file_path).text();
      return content ?? `Error: file at "${file_path}" was empty or unreadable`;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return `Error: file not found at path "${file_path}"`;
      if (code === "EACCES") return `Error: permission denied reading "${file_path}"`;
      return `Error: unable to read "${file_path}" — ${(err as Error).message ?? "unknown error"}`;
    }
  },
  {
    name: "read_file",
    description: "Read a file from disk and return its contents as a string.",
    schema: z.object({
      file_path: z.string().describe("Absolute or relative path to the file to read."),
    }),
  }
);
