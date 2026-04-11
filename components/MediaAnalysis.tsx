import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, FileImage, FileVideo, FileAudio, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type MediaType = 'image' | 'video' | 'audio' | null;

const MediaAnalysis: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    // Determine type
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

    // Create preview
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
      
      let modelName = 'gemini-3.1-pro-preview'; // Default for image/video
      if (mediaType === 'audio') {
        modelName = 'gemini-3-flash-preview'; // Audio transcription uses flash
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type,
              }
            },
            { text: prompt }
          ]
        }
      });

      setResult(response.text || 'No analysis generated.');
    } catch (error: any) {
      console.error('Analysis error:', error);
      setResult(`Error analyzing media: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-6 md:p-10 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-indigo-400" />
            Media Analysis
          </h1>
          <p className="text-zinc-400">Upload images, videos, or audio files for Gemini to analyze.</p>
        </div>

        {/* Upload Area */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-700 hover:border-indigo-500/50 bg-zinc-900/50 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*,video/*,audio/*" 
            className="hidden" 
          />
          
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
            <Upload className="w-8 h-8 text-zinc-400 group-hover:text-indigo-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-200 mb-1">Click to upload media</h3>
          <p className="text-sm text-zinc-500">Supports Images, Videos (up to 1MB base64), and Audio</p>
        </div>

        {/* Preview & Analysis Area */}
        {file && previewUrl && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-xl">
            
            {/* Left: Preview */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-300 font-medium pb-4 border-b border-zinc-800">
                {mediaType === 'image' && <FileImage className="w-5 h-5 text-blue-400" />}
                {mediaType === 'video' && <FileVideo className="w-5 h-5 text-purple-400" />}
                {mediaType === 'audio' && <FileAudio className="w-5 h-5 text-emerald-400" />}
                {file.name}
              </div>
              
              <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-zinc-800">
                {mediaType === 'image' && <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />}
                {mediaType === 'video' && <video src={previewUrl} controls className="max-w-full max-h-full" />}
                {mediaType === 'audio' && <audio src={previewUrl} controls className="w-full px-4" />}
              </div>
            </div>

            {/* Right: Controls & Result */}
            <div className="space-y-6 flex flex-col">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Prompt for Gemini</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-100 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none h-24"
                />
              </div>
              
              <button
                onClick={analyzeMedia}
                disabled={isAnalyzing || !prompt.trim()}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze Media
                  </>
                )}
              </button>

              {result && (
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-5 overflow-y-auto max-h-[300px]">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MediaAnalysis;
