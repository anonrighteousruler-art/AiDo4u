import React, { useState, useRef } from 'react';
import { Upload, FileImage, FileVideo, FileAudio, Loader2, Sparkles, Menu, X, Settings as SettingsIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSettings } from '../SettingsContext';

type MediaType = 'image' | 'video' | 'audio' | null;

interface MediaAnalysisProps {
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
}

const MediaAnalysis: React.FC<MediaAnalysisProps> = ({ isSidebarVisible, toggleSidebar }) => {
  const { settings, updateSettings } = useSettings();
  const mediaSettings = settings.media;

  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    if (selectedFile.type.startsWith('image/')) {
      setMediaType('image');
      setPrompt('Describe this image in detail.');
    } else if (selectedFile.type.startsWith('video/')) {
      setMediaType('video');
      setPrompt('What is happening in this video?');
    } else if (selectedFile.type.startsWith('audio/')) {
      setMediaType('audio');
      setPrompt('Transcribe this audio.');
    } else {
      setMediaType(null);
      alert('Unsupported file type.');
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const analyzeMedia = async () => {
    if (!file || !mediaType || !prompt.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      const base64Data = await fileToBase64(file);
      
      let modelName = 'gemini-3.1-pro-preview';
      if (mediaType === 'audio') {
        modelName = 'gemini-3-flash-preview';
      }

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: file.type } },
              { text: prompt }
            ]
          }
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setResult(data.text || 'No analysis generated.');
    } catch (error: any) {
      console.error('Analysis error:', error);
      setResult(`Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-6 md:p-10 overflow-y-auto relative">
      <div className="absolute top-4 left-4 flex gap-2 z-50">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Toggle Sidebar"
        >
          {isSidebarVisible ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-4 p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors z-50"
        title="Settings"
      >
        <SettingsIcon className="w-5 h-5" />
      </button>

      <div className="max-w-4xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-indigo-400" /> Media Analysis
          </h1>
          <p className="text-zinc-400">Deep visual and auditory understanding powered by Gemini Suite.</p>
        </div>

        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-900/30 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
        >
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*,audio/*" className="hidden" />
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-all">
            <Upload className="w-8 h-8 text-zinc-400 group-hover:text-indigo-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-200 mb-1">Upload your media</h3>
        </div>

        {file && previewUrl && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-xl">
            <div className="space-y-4">
               <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-zinc-800">
                {mediaType === 'image' && <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />}
                {mediaType === 'video' && <video src={previewUrl} controls className="max-w-full max-h-full" />}
                {mediaType === 'audio' && <audio src={previewUrl} controls className="w-full px-4" />}
              </div>
            </div>
            <div className="space-y-6 flex flex-col">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-100 focus:ring-2 focus:ring-indigo-500/50 h-32"
              />
              <button
                onClick={analyzeMedia}
                disabled={isAnalyzing || !prompt.trim()}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
              >
                {isAnalyzing ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</> : <><Sparkles className="w-5 h-5" /> Run Analysis</>}
              </button>
              {result && (
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-5 overflow-y-auto max-h-[300px]">
                  <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{result}</ReactMarkdown></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="absolute inset-x-8 top-20 bottom-8 bg-zinc-950 border border-zinc-800 rounded-3xl z-40 p-8 flex flex-col gap-6 shadow-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-zinc-100">Media Analysis Settings</h2>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-6 h-6" /></button>
          </div>
          <div className="space-y-6">
            <p className="text-zinc-500 text-sm">Media analysis uses specialized models depending on the content type to ensure maximum accuracy.</p>
          </div>
          <button onClick={() => setShowSettings(false)} className="mt-auto py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600">Close</button>
        </div>
      )}
    </div>
  );
};

export default MediaAnalysis;
