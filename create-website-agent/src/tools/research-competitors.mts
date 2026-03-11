import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { load } from 'cheerio';
import { agentIO } from '../server/agent-io.mts';
import { env } from '../env.mts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo' | 'tavily';
}

interface ScrapeData {
  url: string;
  title: string;
  description: string;
  colors: string[];
  fonts: string[];
  sections: string[];
  bodyText: string;
}

// ─── DuckDuckGo search ────────────────────────────────────────────────────────

async function duckDuckGoSearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebsiteBuilderBot/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = load(html);
    const results: SearchResult[] = [];
    $('.result__body').each((i, el) => {
      if (i >= maxResults) return false;
      const title = $(el).find('.result__title').text().trim();
      const url = $(el).find('.result__url').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      if (title) results.push({ title, url, snippet, source: 'duckduckgo' });
    });
    return results;
  } catch {
    return [];
  }
}

// ─── Tavily search ────────────────────────────────────────────────────────────

async function tavilySearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  if (!env.TAVILY_API_KEY) return [];
  try {
    const { TavilySearch } = await import('@langchain/tavily');
    const tavily = new TavilySearch({ maxResults, tavilyApiKey: env.TAVILY_API_KEY });
    const raw = await tavily.invoke({ query });
    const parsed: Array<{ title?: string; url?: string; content?: string }> =
      typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed.map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
      source: 'tavily' as const,
    }));
  } catch {
    return [];
  }
}

// ─── Deduplicate by URL ───────────────────────────────────────────────────────

function dedup(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── URL scraper ──────────────────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<ScrapeData> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebsiteBuilderBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return emptyScape(url);
    const html = await res.text();
    const $ = load(html);

    const title = $('title').text().trim();
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    const colorRegex = /#(?:[0-9a-fA-F]{3}){1,2}|rgb\(\d+,\s*\d+,\s*\d+\)/g;
    const colors: string[] = [];
    $('[style]').each((_, el) => {
      const found = ($(el).attr('style') ?? '').match(colorRegex);
      if (found) colors.push(...found);
    });
    $('style').each((_, el) => {
      const found = ($(el).html() ?? '').match(colorRegex);
      if (found) colors.push(...found);
    });

    const fonts: string[] = [];
    const fontRegex = /font-family:\s*([^;}"']+)/g;
    $('style').each((_, el) => {
      const css = $(el).html() ?? '';
      let m;
      while ((m = fontRegex.exec(css)) !== null) {
        fonts.push((m[1] ?? '').trim().replace(/['"]/g, '').split(',')[0]?.trim() ?? '');
      }
    });

    const sectionSelectors = [
      'header', 'nav', 'main', 'section', 'footer',
      '[class*="hero"]', '[class*="about"]', '[class*="service"]', '[class*="contact"]',
    ];
    const sections: string[] = sectionSelectors.filter((sel) => $(sel).length > 0);

    $('script, style, noscript').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 1500);

    return {
      url,
      title,
      description,
      colors: [...new Set(colors)].slice(0, 10),
      fonts: [...new Set(fonts)].slice(0, 5),
      sections,
      bodyText,
    };
  } catch {
    return emptyScape(url);
  }
}

function emptyScape(url: string): ScrapeData {
  return { url, title: url, description: '', colors: [], fonts: [], sections: [], bodyText: '' };
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

/**
 * Step 2: Research competitor websites and industry trends.
 * Combines DuckDuckGo + Tavily results, deduplicates by URL, prints to console,
 * and scrapes the provided sample URLs for design patterns.
 */
export const researchCompetitorsTool = tool(
  async ({ companyName, industry, sampleUrls, currentSiteUrl }): Promise<string> => {
    agentIO.stage('2', 'Research — scraping competitors & industry trends');

    const query = `${industry} website design trends best practices landing page`;
    agentIO.log(`Searching: "${query}"`);

    // Run both searches in parallel
    const [ddgResults, tavilyResults] = await Promise.all([
      duckDuckGoSearch(query),
      tavilySearch(query),
    ]);

    const combined = dedup([...ddgResults, ...tavilyResults]);

    // Print combined list to console
    console.log('\n─── Search Results ─────────────────────────────────────────');
    combined.forEach((r, i) => {
      console.log(`${i + 1}. [${r.source}] ${r.title}`);
      console.log(`   ${r.url}`);
      console.log(`   ${r.snippet.slice(0, 120)}`);
    });
    console.log('────────────────────────────────────────────────────────────\n');

    agentIO.log(`Found ${combined.length} search results (DuckDuckGo + Tavily, deduped)`);

    // Scrape sample URLs
    const urlsToScrape = [...sampleUrls];
    if (currentSiteUrl) urlsToScrape.unshift(currentSiteUrl);

    const scrapeResults: ScrapeData[] = [];
    for (const url of urlsToScrape.slice(0, 4)) {
      agentIO.log(`Scraping: ${url}`);
      scrapeResults.push(await scrapeUrl(url));
    }

    const searchSummary = combined
      .slice(0, 6)
      .map((r, i) => `${i + 1}. ${r.title} — ${r.snippet.slice(0, 200)}`)
      .join('\n');

    const scrapeSummary = scrapeResults
      .map(
        (d) =>
          `URL: ${d.url}\nTitle: ${d.title}\nDescription: ${d.description}\n` +
          `Colors: ${d.colors.join(', ') || 'none'}\nFonts: ${d.fonts.join(', ') || 'none'}\n` +
          `Sections: ${d.sections.join(', ') || 'unknown'}\nText: ${d.bodyText.slice(0, 400)}`
      )
      .join('\n\n---\n\n');

    const researchResult = JSON.stringify({
      company: companyName,
      industry,
      searchResults: searchSummary,
      scrapedSites: scrapeSummary,
    });
    agentIO.saveForRevision('researchNotesJson', researchResult);
    agentIO.done('Research');
    return researchResult;
  },
  {
    name: 'research_competitors',
    description:
      'Search DuckDuckGo and Tavily for industry design trends, scrape sample competitor URLs. Call after collect_business_info.',
    schema: z.object({
      companyName: z.string().describe('Company name from the interview'),
      industry: z.string().describe('Industry from the interview'),
      sampleUrls: z.array(z.string()).describe('URLs from the interview to scrape for design inspiration'),
      currentSiteUrl: z.string().optional().describe('Current website URL if provided'),
    }),
  }
);
