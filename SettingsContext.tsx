import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppMode } from './types';

type BehaviorProfile = 'professional' | 'friendly' | 'direct' | 'encouraging' | 'teacher' | 'accessibility' | 'custom';

interface Settings {
  chatterboxStyle: 'standard' | 'glass' | 'neo' | 'minimal';
  voiceName: string;
  autoCaptureRate: number; // in ms
  handsFreeMode: boolean;
  behaviorProfile: BehaviorProfile;
  customBehaviorInstructions: string;
}

interface SettingsContextType {
  settings: Record<AppMode, Settings>;
  updateSettings: (mode: AppMode, newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  chatterboxStyle: 'standard',
  voiceName: 'Zephyr',
  autoCaptureRate: 2000,
  handsFreeMode: true,
  behaviorProfile: 'friendly',
  customBehaviorInstructions: '',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Record<AppMode, Settings>>(() => {
    const saved = localStorage.getItem('gemini-suite-settings');
    if (saved) return JSON.parse(saved);
    return {
      screen: { ...defaultSettings },
      'live-audio': { ...defaultSettings },
      chatbot: { ...defaultSettings },
      media: { ...defaultSettings },
      index: { ...defaultSettings },
    };
  });

  useEffect(() => {
    localStorage.setItem('gemini-suite-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (mode: AppMode, newSettings: Partial<Settings>) => {
    setSettings(prev => ({
      ...prev,
      [mode]: { ...prev[mode], ...newSettings },
    }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
