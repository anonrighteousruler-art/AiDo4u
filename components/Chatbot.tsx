import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Send, Loader2, Brain, Zap, Globe, MapPin, Sparkles, Menu, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type ChatMode = 'standard' | 'thinking' | 'fast' | 'search' | 'maps';

interface ChatbotProps {
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ isSidebarVisible, toggleSidebar }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Hello! I am Gemini. Choose a mode below and ask me anything.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('standard');
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
          config = { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } };
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

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userText,
        config,
      });

      let responseText = response.text || 'No response generated.';
      
      // Append grounding chunks if available
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
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

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      <button
        onClick={toggleSidebar}
        className="absolute top-4 left-4 p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors z-50"
        title="Toggle Sidebar"
      >
        {isSidebarVisible ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Header / Mode Selector */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex flex-wrap gap-2 items-center justify-center pl-16">
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
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-sm' 
                  : 'bg-zinc-900 text-zinc-200 rounded-bl-sm border border-zinc-800 shadow-sm'
              }`}>
                {msg.isThinking && (
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-3 pb-3 border-b border-zinc-800">
                    <Brain className="w-4 h-4" />
                    Gemini thought deeply about this
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
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
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50 shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
