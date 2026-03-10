import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const writeFileTool = tool(
  async ({ file_path, content }): Promise<string> => {
    try {
      await Bun.write(file_path, content);
      return `Success: file written to "${file_path}"`;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return `Error: directory does not exist for path "${file_path}"`;
      if (code === "EACCES") return `Error: permission denied writing to "${file_path}"`;
      return `Error: unable to write "${file_path}" — ${(err as Error).message ?? "unknown error"}`;
    }
  },
  {
    name: "write_file",
    description: "Write content to a file on disk. Creates the file if it does not exist, overwrites it if it does.",
    schema: z.object({
      file_path: z.string().describe("Absolute or relative path to the file to write."),
      content: z.string().describe("The content to write to the file."),
    }),
  }
);
