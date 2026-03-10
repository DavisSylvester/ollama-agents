import { join } from "path";
import type { TopicInput } from "../types/index.mts";

const topicsFile = join(import.meta.dirname, "../../../config/topics.json");

interface TopicsConfig {
  topics: TopicInput[];
}

export async function loadTopics(): Promise<TopicInput[]> {
  try {
    const raw = await Bun.file(topicsFile).text();
    const config = JSON.parse(raw) as TopicsConfig;
    return config.topics ?? [];
  } catch (err) {
    console.error("[trigger-load-topics] failed to load config/topics.json:", (err as Error).message);
    return [];
  }
}
