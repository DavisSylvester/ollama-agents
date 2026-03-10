import { StateGraph, StateSchema, MessagesValue, START, END } from "@langchain/langgraph";
import type { GraphNode } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ollamaModel } from "../models/index.mts";
import { researchGraph } from "../graphs/index.mts";

const researchTool = researchGraph.asTool({
  name: "youtube_research",
  description: "Runs the full YouTube research pipeline — reads all 9 workflow steps in order and returns the collected research state.",
  schema: z.object({}),
});

const tools = [researchTool];
const modelWithTools = ollamaModel.bindTools(tools);

const AgentState = new StateSchema({ messages: MessagesValue });

const llmCall: GraphNode<typeof AgentState> = async (state) => {
  const response = await modelWithTools.invoke(state.messages);
  return { messages: [response] };
};

const shouldContinue = (state: typeof AgentState.State) => {
  const last = state.messages.at(-1);
  if (AIMessage.isInstance(last) && (last.tool_calls?.length ?? 0) > 0) return "tools";
  return END;
};

export const youtubeVideoAgent = new StateGraph(AgentState)
  .addNode("llm", llmCall)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "llm")
  .addConditionalEdges("llm", shouldContinue, ["tools", END])
  .addEdge("tools", "llm")
  .compile();
