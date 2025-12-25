export interface VocabularyItem {
  word: string;
  ipa?: string; // Phonetic transcription
  definition: string; // Chinese meaning
  example: string; // English example sentence
}

export interface StoryContent {
  title: string;
  content: string; // Main content (supports Markdown for bolding)
  // Legacy fields for migration support (optional)
  english?: string;
  chinese?: string;
}

export interface DailyLesson {
  id: string; // UUID (Client side generated ID, stored as 'localId' in Cloud)
  _objectId?: string; // LeanCloud ObjectId
  date: string; // ISO Date string YYYY-MM-DD
  vocabularyTitle: string; // Title for the vocab set
  vocabulary: VocabularyItem[];
  story: StoryContent;
  audioBlob?: Blob; // Used for local preview/upload
  audioUrl?: string; // URL from Cloud Storage
  createdAt: number;
  order?: number; // Added for manual sorting
}

// For the form state
export interface LessonFormData {
  date: string;
  rawText: string;
  vocabulary: VocabularyItem[];
  story: StoryContent;
  audioFile: File | null;
}

export type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';