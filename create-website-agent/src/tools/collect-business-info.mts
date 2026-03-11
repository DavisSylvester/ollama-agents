import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { askRequired, askOptional, askList, ask, agentIO } from '../server/agent-io.mts';
import { slugify, type BusinessContext, type Tone } from '../types/index.mts';

const TONES: Tone[] = ['professional', 'friendly', 'bold', 'minimal'];

/**
 * Step 1: Interview the user via the web UI.
 * Collects all business context needed to build the landing page.
 * Returns a JSON string of BusinessContext.
 */
export const collectBusinessInfoTool = tool(
  async (_input): Promise<string> => {
    agentIO.stage('1', 'Interview — collecting your business information');
    agentIO.log('I will ask you a few questions to understand your business.');

    const companyName = await askRequired('What is your company name?');
    const industry = await askRequired('What industry are you in?');
    const targetAudience = await askRequired('Who is your target audience?');
    const tagline = await askOptional('Do you have a tagline or slogan?');
    const services = await askList('What services or products do you offer?');
    const currentSiteUrl = await askOptional('Do you have a current website URL?');
    const sampleUrls = await askList('Paste URLs of websites you like for design inspiration');

    const toneRaw = await ask('What tone should your site have?', TONES);
    const tone: Tone = (TONES as string[]).includes(toneRaw) ? (toneRaw as Tone) : 'professional';

    // Logo upload → auto-detect brand colors
    agentIO.log('You can upload your logo to auto-detect brand colors (optional).');
    const logoFile = await agentIO.askUpload('Upload your logo (PNG, JPG, or SVG)', 'image/*');

    let brandColors: string[] | undefined;

    agentIO.thinking();

    if (logoFile) {
      agentIO.log('Logo received — brand colors will be chosen by the AI based on your industry and tone.');
      // Note: Vision-based color extraction can be wired in here if the Ollama server
      // has a vision-capable model available. For now we proceed without it.
    }

    agentIO.thinkingEnd();

    if (!brandColors) {
      const raw = await askOptional(
        'Enter brand colors as hex codes separated by commas (e.g. #2563EB, #1E293B) — leave blank to let AI choose'
      );
      brandColors = raw ? raw.split(',').map((c) => c.trim()).filter(Boolean) : undefined;
    }

    agentIO.done('Interview');

    const context: BusinessContext = {
      companyName,
      slug: slugify(companyName),
      industry,
      tagline,
      services: services.length ? services : ['General services'],
      targetAudience,
      brandColors,
      tone,
      currentSiteUrl,
      sampleUrls,
    };

    const result = JSON.stringify(context, null, 2);
    agentIO.saveForRevision('businessContextJson', result);
    agentIO.saveForRevision('baseSlug', context.slug);
    agentIO.log(`Business profile captured for: ${companyName}`);
    return result;
  },
  {
    name: 'collect_business_info',
    description:
      'Interview the user through the web UI to collect all business information needed to build their landing page. Call this first.',
    schema: z.object({}),
  }
);
