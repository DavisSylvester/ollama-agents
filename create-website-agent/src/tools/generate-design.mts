import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { agentIO } from '../server/agent-io.mts';
import { structuredModel } from '../models/index.mts';
import type { DesignBrief } from '../types/index.mts';

const designBriefSchema = z.object({
  primaryColor: z.string().describe('Hex color code, e.g. #2563EB'),
  secondaryColor: z.string().describe('Hex color code'),
  accentColor: z.string().describe('Hex color code'),
  fontPairing: z.string().describe('e.g. "Inter for headings, Lora for body"'),
  layoutStyle: z.string().describe('Description of the overall layout aesthetic'),
  sectionOrder: z.array(z.string()).describe('Ordered list of page sections'),
});

/**
 * Step 4: Generate a design brief using the Ollama LLM.
 * Returns structured DesignBrief JSON with colors, fonts, and layout.
 */
export const generateDesignTool = tool(
  async ({ businessContextJson, researchNotes }): Promise<string> => {
    agentIO.stage('4', 'Design — generating color palette and layout');
    agentIO.streamStart('Designing');

    const ctx = JSON.parse(businessContextJson) as Partial<{ companyName: string; industry: string; tone: string; brandColors?: string[] }>;

    const system = new SystemMessage(
      `You are an expert UI/UX designer specialising in landing page design.
Create a modern, visually appealing design brief.
If brand colors are provided, use them as the primary palette and complement them.
Return only valid JSON — no markdown, no extra text.`
    );

    const user = new HumanMessage(
      `Create a design brief for:

Company: ${ctx.companyName}
Industry: ${ctx.industry}
Tone: ${ctx.tone}
Brand colors provided: ${ctx.brandColors?.join(', ') ?? 'none — choose appropriate colors'}

Research / competitor analysis:
${researchNotes}

Return JSON with this shape:
{
  primaryColor: "#hex",
  secondaryColor: "#hex",
  accentColor: "#hex",
  fontPairing: "...",
  layoutStyle: "...",
  sectionOrder: ["hero", "about", "services", "contact"]
}`
    );

    const structured = structuredModel.withStructuredOutput(designBriefSchema);
    const brief: DesignBrief = await structured.invoke([system, user]);

    agentIO.streamEnd();
    agentIO.done('Design');
    return JSON.stringify(brief, null, 2);
  },
  {
    name: 'generate_design',
    description:
      'Generate a design brief (color palette, fonts, layout) for the landing page. Call after generate_copy.',
    schema: z.object({
      businessContextJson: z.string().describe('Full BusinessContext JSON from collect_business_info'),
      researchNotes: z.string().describe('Research notes from research_competitors'),
    }),
  }
);
