/**
 * Typed environment variable access.
 * All env var reads in the app go through this module.
 */

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const env = {
  OLLAMA_HOST: optionalEnv('OLLAMA_HOST', 'http://192.168.128.230:11434'),
  OLLAMA_MODEL: optionalEnv('OLLAMA_MODEL', 'qwen3'),
  GEMINI_API_KEY: optionalEnv('GEMINI_API_KEY'),
  TAVILY_API_KEY: optionalEnv('TAVILY_API_KEY'),
  PORT: parseInt(optionalEnv('PORT', '3000'), 10),
} as const;
