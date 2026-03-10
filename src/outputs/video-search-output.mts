import { ollamaModel } from "../models/index.mts";
import { readFileSync } from "fs";
import { join } from "path";

const workflow = readFileSync(
  join(import.meta.dirname, "../../workflows/youtube-search/research.md"),
  "utf-8"
);

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerIndex = 0;
const spinner = setInterval(() => {
  process.stdout.write(`\r${spinnerFrames[spinnerIndex++ % spinnerFrames.length]} Model is thinking...`);
}, 100);

const output = await ollamaModel.invoke(
  `${workflow}\n\nSearch for Claude code and ralph loop videos from yesterday`
);

clearInterval(spinner);
process.stdout.write("\r\x1b[K"); // clear the spinner line

console.log("Output:", output);