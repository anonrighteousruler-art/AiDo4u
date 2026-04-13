export type AppMode = 
  | 'screen'
  | 'live-audio'
  | 'chatbot'
  | 'media'
  | 'index';

export interface Message {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  isThinking?: boolean;
}
