import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { agentIO } from '../server/agent-io.mts';

/**
 * Step 7: Write the generated HTML to disk under generated-websites/<slug>/.
 * Appends -2, -3, etc. to the folder name if the slug already exists,
 * so existing sites are never overwritten.
 */

async function findAvailableFolder(baseName: string): Promise<string> {
  const baseDir = resolve(process.cwd(), 'generated-websites', baseName);
  try {
    await stat(baseDir);
    // Folder exists — find next available suffix
    for (let i = 2; i <= 99; i++) {
      const candidate = `${baseName}-${i}`;
      try {
        await stat(resolve(process.cwd(), 'generated-websites', candidate));
      } catch {
        return candidate;
      }
    }
    return `${baseName}-${Date.now()}`;
  } catch {
    return baseName; // does not exist yet
  }
}

export const writeOutputTool = tool(
  async ({ slug, html }): Promise<string> => {
    agentIO.stage('7', 'Save — writing your site to disk');

    const folderName = await findAvailableFolder(slug);
    const outputDir = resolve(process.cwd(), 'generated-websites', folderName);
    await mkdir(outputDir, { recursive: true });

    const filePath = join(outputDir, 'index.html');
    await writeFile(filePath, html, 'utf-8');

    const relativePath = `generated-websites/${folderName}/index.html`;
    agentIO.log(`Saved: ${relativePath}`);
    agentIO.done('Save');
    agentIO.complete(folderName);

    return JSON.stringify({ slug: folderName, filePath: relativePath });
  },
  {
    name: 'write_output',
    description:
      'Write the generated HTML to generated-websites/<slug>/index.html. Call this last, after generate_html.',
    schema: z.object({
      slug: z.string().describe('Company slug (used as the output folder name)'),
      html: z.string().describe('Complete HTML string from generate_html'),
    }),
  }
);
