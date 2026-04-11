export type AppMode = 
  | 'screen'
  | 'live-audio'
  | 'chatbot'
  | 'media';

export interface Message {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  isThinking?: boolean;
}
