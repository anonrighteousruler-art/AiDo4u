import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Brain, Zap, Globe, MapPin, Sparkles, Menu, X, Settings as SettingsIcon, Palette, ChevronDown, UserCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, AppMode } from '../types';
import { useSettings } from '../SettingsContext';
import { getBehaviorPrompt } from '../utils/behavior';

type ChatMode = 'standard' | 'thinking' | 'fast' | 'search' | 'maps';

interface ChatbotProps {
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ isSidebarVisible, toggleSidebar }) => {
  const { settings, updateSettings } = useSettings();
  const chatbotSettings = settings.chatbot;

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Hello! I am Gemini. I can help you with reasoning, web searches, and more.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('standard');
  const [showSettings, setShowSettings] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'user', text: userText }]);

    try {
      let modelName = 'gemini-3.1-pro-preview';
      let config: any = {};

      switch (mode) {
        case 'thinking':
          modelName = 'gemini-3.1-pro-preview';
          config = { thinkingConfig: { thinkingLevel: 'HIGH' } };
          break;
        case 'fast':
          modelName = 'gemini-3.1-flash-lite-preview';
          break;
        case 'search':
          modelName = 'gemini-3-flash-preview';
          config = { tools: [{ googleSearch: {} }] };
          break;
        case 'maps':
          modelName = 'gemini-2.5-flash';
          config = { tools: [{ googleMaps: {} }] };
          break;
        default:
          modelName = 'gemini-3.1-pro-preview';
      }

      const behaviorPrompt = getBehaviorPrompt(chatbotSettings.behaviorProfile, chatbotSettings.customBehaviorInstructions);

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          contents: { parts: [{ text: userText }] },
          systemInstruction: behaviorPrompt,
          config
        }),
      });

      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();

      let responseText = data.text || 'No response generated.';
      
      const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        responseText += '\n\n**Sources:**\n';
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri) {
            responseText += `- [${chunk.web.title || chunk.web.uri}](${chunk.web.uri})\n`;
          } else if (chunk.maps?.uri) {
            responseText += `- [${chunk.maps.title || 'Google Maps Location'}](${chunk.maps.uri})\n`;
          }
        });
      }

      setMessages(prev => [...prev, { role: 'assistant', text: responseText, isThinking: mode === 'thinking' }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const modes: { id: ChatMode; icon: any; label: string }[] = [
    { id: 'standard', icon: Sparkles, label: 'Standard' },
    { id: 'thinking', icon: Brain, label: 'Deep Think' },
    { id: 'fast', icon: Zap, label: 'Fast' },
    { id: 'search', icon: Globe, label: 'Web Search' },
    { id: 'maps', icon: MapPin, label: 'Maps' },
  ];

  const chatterStyles: Record<string, string> = {
    standard: "bg-zinc-900 text-zinc-200 border border-zinc-800",
    glass: "bg-white/5 backdrop-blur-lg border border-white/10 text-white shadow-xl",
    neo: "bg-indigo-600/10 border-2 border-indigo-500/50 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.15)]",
    minimal: "bg-transparent border-l-2 border-indigo-500 rounded-none pl-4 text-zinc-300",
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      <div className="absolute top-4 left-4 flex gap-2 z-50">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Toggle Sidebar"
        >
          {isSidebarVisible ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <div className="relative">
          <button 
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <Palette className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
          {showStyleMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1">
              {Object.keys(chatterStyles).map(style => (
                <button
                  key={style}
                  onClick={() => {
                    updateSettings('chatbot', { chatterboxStyle: style as any });
                    setShowStyleMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors capitalize"
                >
                  {style}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Chatbot Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Header / Mode Selector */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex flex-wrap gap-2 items-center justify-center pt-14">
        {modes.map(m => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' 
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${chatterStyles[chatbotSettings.chatterboxStyle]} ${
                msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm shadow-sm'
              }`}>
                {msg.isThinking && (
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-3 pb-3 border-b border-zinc-800/50">
                    <Brain className="w-4 h-4" />
                    Gemini thought deeply about this
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-3 text-zinc-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                {mode === 'thinking' ? 'Thinking deeply...' : 'Generating response...'}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto relative">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask Gemini (${modes.find(m => m.id === mode)?.label} mode)...`}
              disabled={isLoading}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-50 shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {showSettings && (
        <div className="absolute inset-x-8 top-20 bottom-8 bg-zinc-950 border border-zinc-800 rounded-3xl z-40 p-8 flex flex-col gap-6 shadow-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-zinc-100">Chatbot Settings</h2>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-6 h-6" /></button>
          </div>
          <p className="text-zinc-500 text-sm italic">Each mode maintains its own independent UI and processing preferences.</p>
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400">Default Mode</label>
              <select 
                value={mode}
                onChange={(e) => setMode(e.target.value as ChatMode)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-200"
              >
                {modes.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <UserCircle className="w-4 h-4" /> Behavior Profile
              </label>
              <select 
                value={chatbotSettings.behaviorProfile}
                onChange={(e) => updateSettings('chatbot', { behaviorProfile: e.target.value as any })}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-200"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
                <option value="encouraging">Encouraging</option>
                <option value="teacher">Teacher</option>
                <option value="accessibility">Accessibility (Plain Language)</option>
                <option value="custom">Custom Instructions</option>
              </select>
            </div>

            {chatbotSettings.behaviorProfile === 'custom' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-400">Custom Behavior Instructions</label>
                <textarea 
                  value={chatbotSettings.customBehaviorInstructions}
                  onChange={(e) => updateSettings('chatbot', { customBehaviorInstructions: e.target.value })}
                  placeholder="e.g. Speak like a pirate, be very sarcastic, etc."
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-200 h-24 resize-none"
                />
              </div>
            )}
          </div>
          <button onClick={() => setShowSettings(false)} className="mt-auto py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600">Save</button>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
