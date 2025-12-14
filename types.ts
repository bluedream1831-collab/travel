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

export interface GeneratedPost {
  platform: Platform;
  title?: string; // For blog posts like Vocus
  content: string;
  hashtags: string[];
}

export interface LocationAnalysis {
  detectedName: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string; // Why did the AI guess this? (e.g., "Signboard says 'Kinkakuji'", "Eiffel Tower visible")
}

export interface GenerationResult {
  analysis: LocationAnalysis;
  posts: GeneratedPost[];
}

export interface UploadedImage {
  id: string;       // Unique ID for React keys
  base64: string;   // Processed image data
  mimeType: string; // e.g. 'image/jpeg'
  previewUrl: string; // For display
  isVideo?: boolean; // New flag to indicate if this source was a video
}

export interface SavedRecord {
  id: number;
  date: string;
  config: {
    tone: Tone;
    customStyle: string;
    locationName: string;
    highlights: string;
    feelings: string;
    platforms: Platform[];
  };
  resultData: GenerationResult; // Changed from results to resultData to store analysis
}