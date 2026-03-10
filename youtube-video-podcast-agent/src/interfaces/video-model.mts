export interface VideoModel {
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string;
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  isShort: boolean;
}