
export interface UserSettings {
  userName: string;
  systemInstruction: string;
  fileContext: string;
  language: 'vi' | 'en';
  translationLangA: string; // e.g., 'vi'
  translationLangB: string; // e.g., 'en'
  apiKey?: string; // New field for custom API Key
  optimizeLatency?: boolean; // Feature to disable thinking for faster response
  voiceSensitivity: number; // 0.1 to 5.0 (Default 1.5)
  userVoiceSample?: string; // Base64 PCM 16kHz Raw Audio
}

export enum EyeState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
  THINKING = 'THINKING',
  SLEEP = 'SLEEP'
}

export enum Emotion {
  NEUTRAL = 'NEUTRAL',
  HAPPY = 'HAPPY',
  EXCITED = 'EXCITED',
  SAD = 'SAD',
  SURPRISED = 'SURPRISED',
  ANGRY = 'ANGRY',
}

export interface VideoState {
  isOpen: boolean;
  type: 'youtube' | null;
  url: string;
  title: string;
}

export interface Reminder {
  label: string;
  time: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  originalText?: string; // Verification text (Source language) for Translator mode
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
}

export interface UserLocation {
  lat: number;
  lng: number;
  address?: string; // Optional display address
}

export type AppMode = 'assistant' | 'translator';