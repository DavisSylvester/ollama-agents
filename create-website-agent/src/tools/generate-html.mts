import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { agentIO } from '../server/agent-io.mts';
import { chattingModel } from '../models/index.mts';
import type { BusinessContext, PageCopy, DesignBrief } from '../types/index.mts';

/** Strip markdown fences from a raw LLM response to extract the HTML document. */
function extractHtml(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const doctype = raw.indexOf('<!DOCTYPE');
  if (doctype !== -1) return raw.slice(doctype).trim();
  const htmlTag = raw.indexOf('<html');
  if (htmlTag !== -1) return raw.slice(htmlTag).trim();
  return raw.trim();
}

/**
 * Step 6: Generate the full HTML + Tailwind landing page.
 * Streams output chunks to the WebSocket client as the model generates.
 */
export const generateHtmlTool = tool(
  async ({ businessContextJson, copyJson, designBriefJson, imagePathsJson }): Promise<string> => {
    agentIO.stage('6', 'Code — building your landing page');
    agentIO.streamStart('Generating HTML');

    const ctx = JSON.parse(businessContextJson) as BusinessContext;
    const copy = JSON.parse(copyJson) as PageCopy;
    const brief = JSON.parse(designBriefJson) as DesignBrief;
    const imagePaths = JSON.parse(imagePathsJson) as Record<string, string>;

    const servicesHtml = copy.services
      .map(
        (s, i) => `
        <div class="service-card">
          <img src="${imagePaths[`service_${i}`] ?? `https://picsum.photos/seed/${ctx.slug}-s${i}/400/300`}" alt="${s.title}" class="service-img" loading="lazy" />
          <h3>${s.title}</h3>
          <p>${s.description}</p>
        </div>`
      )
      .join('\n');

    const system = new SystemMessage(
      `You are an expert front-end developer. Generate a complete, production-quality single-page HTML landing page.

REQUIREMENTS:
- Use Tailwind CSS via CDN (https://cdn.tailwindcss.com)
- Include a <script> block after the Tailwind CDN to configure custom colors
- Mobile-first, fully responsive
- Smooth scroll navigation
- All sections: hero, about, services, contact, footer
- Sticky navigation bar with company name and anchor links
- Hero: full-viewport background image, headline, subheadline, CTA button
- About: image + text side by side (md:flex-row)
- Services: responsive card grid
- Contact: HTML form (name, email, message, submit)
- Footer with copyright
- Use the exact colors, fonts, and copy provided
- Return ONLY the complete HTML document — no markdown, no explanation`
    );

    const user = new HumanMessage(
      `Generate a landing page for:

Company: ${ctx.companyName}
Industry: ${ctx.industry}
Tone: ${ctx.tone}

DESIGN:
Primary: ${brief.primaryColor}
Secondary: ${brief.secondaryColor}
Accent: ${brief.accentColor}
Fonts: ${brief.fontPairing}
Layout: ${brief.layoutStyle}

COPY:
Hero headline: "${copy.hero.headline}"
Hero subheadline: "${copy.hero.subheadline}"
Hero CTA: "${copy.hero.cta}"
About heading: "${copy.about.heading}"
About body: "${copy.about.body}"
Hero image: "${imagePaths['hero'] ?? ''}"
About image: "${imagePaths['about'] ?? ''}"

Services grid HTML (embed inside the services section):
${servicesHtml}

Contact heading: "${copy.contact.heading}"
Contact body: "${copy.contact.body}"

Return the complete HTML starting with <!DOCTYPE html>.`
    );

    // Stream response chunk-by-chunk to the WebSocket client
    let fullHtml = '';
    const stream = await chattingModel.stream([system, user]);
    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string' ? chunk.content : '';
      agentIO.stream(text);
      fullHtml += text;
    }

    agentIO.streamEnd();
    agentIO.done('Code');
    return extractHtml(fullHtml);
  },
  {
    name: 'generate_html',
    description:
      'Generate the complete HTML/Tailwind landing page. Call after generate_design and generate_images.',
    schema: z.object({
      businessContextJson: z.string().describe('Full BusinessContext JSON'),
      copyJson: z.string().describe('PageCopy JSON from generate_copy'),
      designBriefJson: z.string().describe('DesignBrief JSON from generate_design'),
      imagePathsJson: z.string().describe('Image paths JSON from generate_images'),
    }),
  }
);
