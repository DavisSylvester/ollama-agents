import { ChatOllama } from "@langchain/ollama";

export const ollamaModel = new ChatOllama({
  baseUrl: process.env["OLLAMA_SERVER_URL"] ?? "http://localhost:11434",
  model: process.env.OLLAMA_MODEL_NAME,
  temperature: 0,
  maxRetries: 10,
  format: "json",
});