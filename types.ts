
export enum Platform {
  INSTAGRAM = 'Instagram',
  FACEBOOK = 'Facebook',
  THREADS = 'Threads',
  VOCUS = 'Fanggezi (方格子)',
  PIXNET = 'Pixnet (痞客邦)',
}

export enum Tone {
  EMOTIONAL = '感性文青',
  HUMOROUS = '幽默風趣',
  INFORMATIVE = '實用資訊',
  EXCITED = '熱情奔放',
}

export enum AIModel {
  GEMINI_2_5_FLASH = 'gemini-2.5-flash-latest',
  GEMINI_3_FLASH = 'gemini-3-flash-preview',
  GEMINI_3_PRO = 'gemini-3-pro-preview',
}

export interface StylePreset {
  id: string;
  name: string;
  content: string;
}

export interface GeneratedPost {
  platform: Platform;
  title?: string;
  content: string;
  hashtags: string[];
}

export interface LocationAnalysis {
  detectedName: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string; 
  mapsUrl?: string;
}

export interface GenerationResult {
  analysis: LocationAnalysis;
  posts: GeneratedPost[];
}

export interface UploadedImage {
  id: string;       
  base64: string;   
  mimeType: string; 
  previewUrl: string; 
  isVideo?: boolean; 
}

export interface SavedRecord {
  id: number;
  date: string;
  config: {
    model: AIModel;
    tone: Tone;
    customStyle: string;
    locationName: string;
    highlights: string;
    feelings: string;
    platforms: Platform[];
  };
  resultData: GenerationResult; 
}
