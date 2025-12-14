export enum Platform {
  INSTAGRAM = 'Instagram',
  FACEBOOK = 'Facebook',
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

export interface UploadedImage {
  file: File;
  previewUrl: string;
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
  results: GeneratedPost[];
}