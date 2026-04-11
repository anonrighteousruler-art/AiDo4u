import React from 'react';
import { MonitorUp, Mic, MessageSquare, Image as ImageIcon, Sparkles } from 'lucide-react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode }) => {
  const modes: { id: AppMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'screen', label: 'Screen Assistant', icon: <MonitorUp className="w-5 h-5" />, desc: 'Agentic Vision & Highlights' },
    { id: 'live-audio', label: 'Live Audio', icon: <Mic className="w-5 h-5" />, desc: 'Conversational Voice' },
    { id: 'chatbot', label: 'AI Chatbot', icon: <MessageSquare className="w-5 h-5" />, desc: 'Thinking, Fast, Search, Maps' },
    { id: 'media', label: 'Media Analysis', icon: <ImageIcon className="w-5 h-5" />, desc: 'Image, Video & Audio' },
  ];

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 h-full flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <h1 className="font-semibold text-zinc-100 tracking-tight">Gemini Suite</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id)}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-start gap-3 ${
              currentMode === mode.id
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <div className={`mt-0.5 ${currentMode === mode.id ? 'text-indigo-400' : 'text-zinc-500'}`}>
              {mode.icon}
            </div>
            <div>
              <div className="font-medium text-sm">{mode.label}</div>
              <div className="text-[11px] opacity-70 mt-0.5">{mode.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="p-4 border-t border-zinc-800">
        <div className="text-[10px] text-zinc-500 leading-tight">
          Firebase Auth & DB provisioning failed due to project permissions. Running in local mode.
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
