export type Tone = 'professional' | 'friendly' | 'bold' | 'minimal';

export interface ServiceItem {
  title: string;
  description: string;
}

export interface DesignBrief {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontPairing: string;
  layoutStyle: string;
  sectionOrder: string[];
}

export interface PageCopy {
  hero: {
    headline: string;
    subheadline: string;
    cta: string;
  };
  about: {
    heading: string;
    body: string;
  };
  services: ServiceItem[];
  contact: {
    heading: string;
    body: string;
  };
}

export interface BusinessContext {
  companyName: string;
  slug: string;
  industry: string;
  tagline?: string;
  services: string[];
  targetAudience: string;
  brandColors?: string[];
  tone: Tone;
  currentSiteUrl?: string;
  sampleUrls: string[];
  researchNotes?: string;
  designBrief?: DesignBrief;
  copy?: PageCopy;
  imagePaths?: Record<string, string>;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
