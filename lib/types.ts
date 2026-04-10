export type Language = 'ES' | 'EN';

export type ImageStatus = 'pending' | 'analyzing' | 'done' | 'error';

export interface AnalysisContext {
  niche: string;
  siteText: string;
  language: Language;
  city?: string;
  regions?: string[];
  keywords?: string;
}

export interface ImageResult {
  filename: string;
  alt: string;
}

export interface ProcessedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: ImageStatus;
  result?: ImageResult;
  error?: string;
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  text: string;
}

export interface AnalyzeRequest {
  imageBase64: string;
  mimeType: string;
  context: AnalysisContext;
}

export interface AnalyzeResponse {
  filename: string;
  alt: string;
}
