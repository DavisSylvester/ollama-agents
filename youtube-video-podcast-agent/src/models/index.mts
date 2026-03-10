import { ChatOllama } from "@langchain/ollama";

export const ollamaModel = new ChatOllama({
  baseUrl: process.env["OLLAMA_SERVER_URL"] ?? "http://localhost:11434",
  model: "deepseek-r1:70b",
  temperature: 0,
});