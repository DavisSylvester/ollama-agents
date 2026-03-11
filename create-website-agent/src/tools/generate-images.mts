import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { GoogleGenAI, Modality } from '@google/genai';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { agentIO } from '../server/agent-io.mts';
import { env } from '../env.mts';

/**
 * Step 5: Generate images for each landing page section.
 *
 * Strategy:
 *  - GEMINI_API_KEY set  -> AI-generated images via Nano Banana (gemini-2.5-flash-image),
 *                           saved as PNG files in output/<slug>/images/
 *  - No API key          -> Picsum Photos placeholder URLs (seeded, deterministic)
 */

function picsumUrl(slug: string, section: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(slug)}-${section}/${w}/${h}`;
}

function buildPrompt(section: string, businessDescription: string): string {
  const ctx = businessDescription ? ` for a ${businessDescription}` : '';
  if (section === 'hero') {
    return `Cinematic wide-angle hero banner${ctx}. Professional business photography, modern bright environment, photorealistic, 4K quality.`;
  }
  if (section === 'about') {
    return `Professional team or workspace scene${ctx}. Warm lighting, approachable modern business environment, photorealistic.`;
  }
  return `Professional service illustration${ctx}. Clean, modern composition, business card style, photorealistic.`;
}

async function generateAiImage(
  ai: GoogleGenAI,
  prompt: string,
  outputPath: string,
): Promise<boolean> {
  try {
    const response = await ai.models.generateContent({
      model: 'nano-banana-pro-preview',
      contents: prompt,
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });
    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          await writeFile(outputPath, buffer);
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export const generateImagesTool = tool(
  async ({ slug, serviceCount, businessDescription }): Promise<string> => {
    agentIO.stage('5', 'Images — generating images for your landing page');
    const imagePaths: Record<string, string> = {};

    if (env.GEMINI_API_KEY) {
      agentIO.log('Image engine: nano-banana-pro-preview');
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const imagesDir = resolve(process.cwd(), 'generated-websites', slug, 'images');
      await mkdir(imagesDir, { recursive: true });

      type Section = { key: string; file: string; w: number; h: number };
      const sections: Section[] = [
        { key: 'hero',  file: 'hero.png',  w: 1920, h: 1080 },
        { key: 'about', file: 'about.png', w: 800,  h: 600  },
        ...Array.from({ length: serviceCount }, (_, i): Section => ({
          key: `service_${i}`,
          file: `service_${i}.png`,
          w: 400,
          h: 300,
        })),
      ];

      for (const { key, file, w, h } of sections) {
        const prompt = buildPrompt(key, businessDescription);
        const outputPath = resolve(imagesDir, file);
        agentIO.log(`  [nano-banana-pro-preview] generating ${key}…`);
        const success = await generateAiImage(ai, prompt, outputPath);
        if (success) {
          imagePaths[key] = `images/${file}`;
          agentIO.log(`  ✓ ${key} — saved via nano-banana-pro-preview`);
        } else {
          imagePaths[key] = picsumUrl(slug, key, w, h);
          agentIO.log(`  ✗ ${key} — nano-banana-pro-preview returned no image, using Picsum fallback`);
        }
      }
      agentIO.log(`Images complete: ${Object.keys(imagePaths).length} generated.`);
    } else {
      agentIO.log('Image engine: Picsum Photos (set GEMINI_API_KEY to use nano-banana-pro-preview)');
      imagePaths['hero']  = picsumUrl(slug, 'hero',  1920, 1080);
      imagePaths['about'] = picsumUrl(slug, 'about', 800,  600);
      for (let i = 0; i < serviceCount; i++) {
        imagePaths[`service_${i}`] = picsumUrl(slug, `svc${i}`, 400, 300);
      }
    }

    agentIO.done('Images');
    return JSON.stringify(imagePaths);
  },
  {
    name: 'generate_images',
    description:
      'Generate images for the hero, about, and service sections. ' +
      'Uses Nano Banana (gemini-2.5-flash-image) AI generation when GEMINI_API_KEY is set, ' +
      'otherwise falls back to Picsum placeholder URLs. Call after generate_design.',
    schema: z.object({
      slug: z.string().describe('Company slug — output folder name and Picsum seed'),
      serviceCount: z.number().int().min(0).max(20).describe('Number of service cards'),
      businessDescription: z
        .string()
        .describe('One-line description of the business for image prompts'),
    }),
  }
);