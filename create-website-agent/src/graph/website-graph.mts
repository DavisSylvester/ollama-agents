import { StateGraph, START, END, Annotation, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, SystemMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { createModel } from '../models/index.mts';
import { agentIO } from '../server/agent-io.mts';
import { warmContextSize, checkContext } from '../utils/context-monitor.mts';
import {
  collectBusinessInfoTool,
  researchCompetitorsTool,
  generateCopyTool,
  generateDesignTool,
  generateImagesTool,
  generateHtmlTool,
  writeOutputTool,
} from '../tools/index.mts';

// ─── All tools the agent can call ────────────────────────────────────────────

const tools = [
  collectBusinessInfoTool,
  researchCompetitorsTool,
  generateCopyTool,
  generateDesignTool,
  generateImagesTool,
  generateHtmlTool,
  writeOutputTool,
];

// ─── Graph state ──────────────────────────────────────────────────────────────
// The ralph loop only needs messages — each tool result becomes a ToolMessage
// that the agent reads before deciding its next tool call.

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

// ─── Agent node ───────────────────────────────────────────────────────────────

const model = createModel(0.7).bindTools(tools);

async function agentNode(state: typeof StateAnnotation.State): Promise<typeof StateAnnotation.State> {
  agentIO.thinking();
  const response = await model.invoke(state.messages);
  agentIO.thinkingEnd();
  await checkContext(response, state.messages, (msg) => agentIO.log(msg));
  return { messages: [response] };
}

// ─── Conditional edge — route to tools or END ─────────────────────────────────

function routeToTools(state: typeof StateAnnotation.State): 'tools' | typeof END {
  const last = state.messages.at(-1);
  if (last instanceof AIMessage && last.tool_calls && last.tool_calls.length > 0) {
    return 'tools';
  }
  return END;
}

// ─── ToolNode — executes whichever tool the agent called ─────────────────────

const toolNode = new ToolNode(tools);

// ─── Compile the ralph loop graph ────────────────────────────────────────────

export const websiteGraph = new StateGraph(StateAnnotation)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', routeToTools)
  .addEdge('tools', 'agent')
  .compile();

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI Website Builder agent. Your job is to build a complete landing page for a business owner.

Follow these 7 steps IN ORDER — do not skip any step:

1. Call collect_business_info — interview the user to capture their business details.
2. Call research_competitors — pass companyName, industry, sampleUrls, and currentSiteUrl from step 1.
3. Call generate_copy — pass the full businessContextJson (from step 1) and researchNotes (from step 2).
4. Call generate_design — pass businessContextJson (step 1) and researchNotes (step 2).
5. Call generate_images — pass the slug, serviceCount (number of services from step 3), and a businessDescription (one-line summary like "{companyName} — {industry}").
6. Call generate_html — pass businessContextJson, copyJson, designBriefJson, and imagePathsJson.
7. Call write_output — pass the slug and the full html string from step 6.

After write_output succeeds, confirm the site is ready and tell the user the output path.
Do not add commentary between tool calls — just call the next tool immediately.`;

// ─── Run function ─────────────────────────────────────────────────────────────

export async function runWebsiteAgent(): Promise<void> {
  await warmContextSize();
  console.log('\n╔═══════════════════════════════════╗');
  console.log('║   AI Website Builder — Ralph Loop  ║');
  console.log('╚═══════════════════════════════════╝\n');

  const result = await websiteGraph.invoke({
    messages: [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage('Build a landing page for my business.'),
    ],
  });

  // Print the final agent message to console
  const finalMsg = result.messages.at(-1);
  if (finalMsg instanceof AIMessage && typeof finalMsg.content === 'string') {
    console.log('\n[agent final]', finalMsg.content);
  }
}

// ─── Revision run (skips collect + research, uses provided data) ──────────────

const REVISION_PROMPT = (slug: string) =>
  `You are an AI Website Builder in REVISION MODE. Business data is already collected.
Use the businessContextJson and researchNotes provided in the user message.
Generate a CREATIVE, visually DIFFERENT version — vary the color palette, layout style, and copy tone.
Use slug="${slug}" for generate_images (serviceCount from copy result) and write_output.

Call these 5 tools IN ORDER (do NOT call collect_business_info or research_competitors):
3. Call generate_copy — pass businessContextJson and researchNotes from the message.
4. Call generate_design — pass businessContextJson and researchNotes. Choose a distinctly different color palette and layout.
5. Call generate_images — pass slug="${slug}", serviceCount (number of services from generate_copy result), businessDescription (one-line summary).
6. Call generate_html — pass businessContextJson, copyJson, designBriefJson, imagePathsJson.
7. Call write_output — pass slug="${slug}" and the full html from generate_html.

Do not add commentary — call the next tool immediately.`;

export async function runRevision(
  businessContextJson: string,
  researchNotesJson: string,
  revisionSlug: string,
): Promise<void> {
  console.log(`\n[revision] starting → ${revisionSlug}`);
  await warmContextSize();

  await websiteGraph.invoke({
    messages: [
      new SystemMessage(REVISION_PROMPT(revisionSlug)),
      new HumanMessage(
        `Generate a revised website.\n\nbusinessContextJson:\n${businessContextJson}\n\nresearchNotes:\n${researchNotesJson}`,
      ),
    ],
  });
}
