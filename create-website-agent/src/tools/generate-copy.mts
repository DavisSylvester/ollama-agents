import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { agentIO } from '../server/agent-io.mts';
import { structuredModel } from '../models/index.mts';
import type { PageCopy } from '../types/index.mts';

const pageCopySchema = z.object({
  hero: z.object({
    headline: z.string(),
    subheadline: z.string(),
    cta: z.string(),
  }),
  about: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  services: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })),
  contact: z.object({
    heading: z.string(),
    body: z.string(),
  }),
});

/**
 * Step 3: Generate landing page copy using the Ollama LLM.
 * Returns structured PageCopy JSON.
 */
export const generateCopyTool = tool(
  async ({ businessContextJson, researchNotes }): Promise<string> => {
    agentIO.stage('3', 'Copywriting — generating landing page content');
    agentIO.streamStart('Writing copy');

    const ctx = JSON.parse(businessContextJson) as Partial<{ companyName: string; industry: string; targetAudience: string; services: string[]; tone: string; tagline?: string }>;

    const system = new SystemMessage(
      `You are an expert copywriter specialising in landing pages.
Generate compelling, conversion-focused copy that matches the brand tone exactly.
Return only valid JSON matching the schema — no markdown, no extra fields.`
    );

    const user = new HumanMessage(
      `Write landing page copy for:

Company: ${ctx.companyName}
Industry: ${ctx.industry}
Target audience: ${ctx.targetAudience}
Services: ${(ctx.services ?? []).join(', ')}
Tone: ${ctx.tone}
Tagline: ${ctx.tagline ?? 'none'}

Research context:
${researchNotes}

Return JSON with this shape:
{
  hero: { headline, subheadline, cta },
  about: { heading, body },
  services: [{ title, description }],
  contact: { heading, body }
}`
    );

    const structured = structuredModel.withStructuredOutput(pageCopySchema);
    const copy: PageCopy = await structured.invoke([system, user]);

    agentIO.streamEnd();
    agentIO.done('Copywriting');
    return JSON.stringify(copy, null, 2);
  },
  {
    name: 'generate_copy',
    description:
      'Generate landing page copy (hero, about, services, contact) using the LLM. Call after research_competitors.',
    schema: z.object({
      businessContextJson: z.string().describe('Full BusinessContext JSON from collect_business_info'),
      researchNotes: z.string().describe('Research notes from research_competitors'),
    }),
  }
);
