import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MonitorUp, MonitorOff, Send, Loader2, Image as ImageIcon, MousePointer2, Keyboard, Info, Save, MessageSquare, Menu, X, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ScreenAssistantProps {
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
}

const ScreenAssistant: React.FC<ScreenAssistantProps> = ({ isSidebarVisible, toggleSidebar }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Hi! I am your Screen-Sharing AI Assistant. Click "Start Sharing" to let me see your screen. You can also click and drag on the screen to highlight an area before asking a question!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Highlight Box State
  const [isDrawing, setIsDrawing] = useState(false);
  const [highlightBox, setHighlightBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

  // Agentic Vision Suggested Actions
  const [agentActions, setAgentActions] = useState<{action: 'CLICK' | 'TYPE', bbox: {x: number, y: number, w: number, h: number}, text?: string}[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      streamRef.current = stream;
      setIsSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  const stopSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    setHighlightBox(null);
    setAgentActions([]);
  };

  // Mouse events for drawing highlight box
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSharing || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setStartPos({ x, y });
    setHighlightBox({ x, y, w: 0, h: 0 });
    setIsDrawing(true);
    setAgentActions([]); // Clear previous actions
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    setHighlightBox({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      w: Math.abs(currentX - startPos.x),
      h: Math.abs(currentY - startPos.y),
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const captureFrame = (): string | null => {
    if (!isSharing || !videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // If there's a highlight box, draw it on the captured frame so Gemini sees it
    if (highlightBox && highlightBox.w > 2 && highlightBox.h > 2) {
      ctx.strokeStyle = '#ef4444'; // Red border
      ctx.lineWidth = 4;
      
      const pxX = (highlightBox.x / 100) * canvas.width;
      const pxY = (highlightBox.y / 100) * canvas.height;
      const pxW = (highlightBox.w / 100) * canvas.width;
      const pxH = (highlightBox.h / 100) * canvas.height;
      
      ctx.strokeRect(pxX, pxY, pxW, pxH);
    }

    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);
    setAgentActions([]);

    const frameDataUrl = captureFrame();
    
    setMessages(prev => [...prev, {
      role: 'user',
      text: userText,
      imageUrl: frameDataUrl || undefined
    }]);

    try {
      const parts: any[] = [];
      
      if (frameDataUrl) {
        const base64Data = frameDataUrl.split(',')[1];
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
      }
      
      parts.push({ text: userText });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
        config: {
          systemInstruction: `You are an AI assistant that can see the user's screen. Analyze the provided image.
If the user drew a red box, pay special attention to that area.
Your goal is to help the user navigate and fill out forms. 
If the user asks where to click, how to find something, or what to type, you MUST respond with the exact bounding box of the target element.

Format your response exactly like this for EACH element you want to highlight:
BBOX: [x, y, width, height] (percentages 0-100)
TYPE: "the text to type" (ONLY if it's an input field)

Example for a login form:
BBOX: [10, 20, 30, 5]
TYPE: "your-email@example.com"
BBOX: [10, 30, 30, 5]
TYPE: "your-password"

Then provide a helpful explanation. Do not use markdown for the BBOX or TYPE lines. Be proactive: if you see an empty form field, suggest what the user should type there based on the field label.`
        }
      });

      const responseText = response.text || 'I could not generate a response.';
      
      // Parse for multiple Agentic Vision actions
      const actions: {action: 'CLICK' | 'TYPE', bbox: {x: number, y: number, w: number, h: number}, text?: string}[] = [];
      const bboxRegex = /BBOX:\s*\[([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\]/g;
      const typeRegex = /TYPE:\s*"([^"]+)"/g;
      
      let bboxMatch;
      while ((bboxMatch = bboxRegex.exec(responseText)) !== null) {
        const typeMatch = typeRegex.exec(responseText);
        actions.push({
          action: typeMatch ? 'TYPE' : 'CLICK',
          bbox: {
            x: parseFloat(bboxMatch[1]),
            y: parseFloat(bboxMatch[2]),
            w: parseFloat(bboxMatch[3]),
            h: parseFloat(bboxMatch[4])
          },
          text: typeMatch ? typeMatch[1] : undefined
        });
      }
      
      if (actions.length > 0) {
        setAgentActions(actions);
      } else {
        // Fallback for older CLICK_AT format
        const clickMatch = responseText.match(/CLICK_AT:\s*\[([\d.]+),\s*([\d.]+)\]/);
        if (clickMatch) {
          const x = parseFloat(clickMatch[1]);
          const y = parseFloat(clickMatch[2]);
          if (!isNaN(x) && !isNaN(y)) {
            setAgentActions([{
              action: 'CLICK',
              bbox: { x: x - 2, y: y - 2, w: 4, h: 4 }
            }]);
          }
        }
      }

      // Clean up the response text before showing it to the user
      let cleanText = responseText
        .replace(/BBOX:\s*\[[\d.,\s]+\]/g, '')
        .replace(/TYPE:\s*"[^"]+"/g, '')
        .replace(/CLICK_AT:\s*\[[\d.,\s]+\]/g, '')
        .trim();

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: cleanText,
      }]);
      
      setHighlightBox(null); // Clear highlight after sending
    } catch (error) {
      console.error('Error calling Gemini:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, I encountered an error while processing your request.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Left Panel: Screen View */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 p-4 relative">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <MonitorUp className="w-5 h-5 text-indigo-400" />
            Screen Assistant
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Toggle Sidebar"
            >
              {isSidebarVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsChatVisible(!isChatVisible)}
              className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Toggle Chat Panel"
            >
              {isChatVisible ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
            <button
              onClick={isSharing ? stopSharing : startSharing}
              className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                isSharing 
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' 
                  : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
              }`}
            >
              {isSharing ? (
                <>
                  <MonitorOff className="w-4 h-4" />
                  Stop Sharing
                </>
              ) : (
                <>
                  <MonitorUp className="w-4 h-4" />
                  Start Sharing
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden relative flex items-center justify-center">
          {!isSharing && (
            <div className="text-center text-zinc-500 flex flex-col items-center gap-3">
              <MonitorUp className="w-12 h-12 opacity-50" />
              <p>Screen sharing is paused.</p>
              <p className="text-sm opacity-75 max-w-xs">Click "Start Sharing" to let the assistant see your screen.</p>
            </div>
          )}
          
          <div 
            ref={overlayRef}
            className={`relative w-full h-full flex items-center justify-center ${isSharing ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <video
              ref={videoRef}
              className={`max-w-full max-h-full object-contain pointer-events-none ${isSharing ? 'block' : 'hidden'}`}
              autoPlay
              playsInline
              muted
            />
            
            {/* Highlight Box Overlay */}
            {highlightBox && (
              <div 
                className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none transition-all duration-75"
                style={{
                  left: `${highlightBox.x}%`,
                  top: `${highlightBox.y}%`,
                  width: `${highlightBox.w}%`,
                  height: `${highlightBox.h}%`,
                }}
              />
            )}

            {/* Agentic Vision Actions Overlay */}
            {agentActions.map((act, i) => (
              <div 
                key={i}
                className="absolute border-4 border-indigo-500 bg-indigo-500/20 pointer-events-none animate-pulse flex items-center justify-center transition-all duration-300"
                style={{
                  left: `${act.bbox.x}%`,
                  top: `${act.bbox.y}%`,
                  width: `${act.bbox.w}%`,
                  height: `${act.bbox.h}%`,
                }}
              >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2 pointer-events-auto">
                  {act.action === 'TYPE' ? <Keyboard className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
                  <span className="max-w-[150px] truncate">
                    {act.action === 'TYPE' ? `Type: "${act.text}"` : 'Click Here'}
                  </span>
                  {act.action === 'TYPE' && act.text && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(act.text || '');
                        alert('Copied to clipboard!');
                      }}
                      className="ml-1 p-1 hover:bg-white/20 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      <Save className="w-3 h-3" />
                    </button>
                  )}
                  {/* Small triangle pointing down */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-indigo-600" />
                </div>
              </div>
            ))}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {isSharing && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="text-xs text-zinc-500 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Click and drag on the video to highlight an area for Gemini.
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-200/80 leading-relaxed">
                <strong className="text-indigo-300">Browser Security Note:</strong> Web apps cannot directly control your computer's mouse or keyboard. Gemini will highlight exactly where to click or type on the preview above, and you can perform the action on your actual screen.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Chat Interface */}
      {isChatVisible && (
        <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col bg-zinc-950 h-full border-l border-zinc-800">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div 
                  className={`px-4 py-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-sm' 
                      : 'bg-zinc-900 text-zinc-200 rounded-bl-sm border border-zinc-800 shadow-sm'
                  }`}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 relative group">
                      <img 
                        src={msg.imageUrl} 
                        alt="Screen capture" 
                        className="w-full max-w-[200px] rounded-lg border border-white/20 opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        Attached
                      </div>
                    </div>
                  )}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.role === 'assistant' && (
                    <button 
                      onClick={() => {
                        const indexData = JSON.parse(localStorage.getItem('ai-data-index') || '[]');
                        const newItem = {
                          id: Date.now().toString(),
                          timestamp: Date.now(),
                          title: 'Screen Insight',
                          content: msg.text
                        };
                        localStorage.setItem('ai-data-index', JSON.stringify([newItem, ...indexData]));
                        alert('Saved to Data Index!');
                      }}
                      className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> Save to Index
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="self-start flex items-center gap-2 text-zinc-500 text-sm px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing screen...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-950">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isSharing ? "Ask about your screen..." : "Start sharing to ask questions..."}
                disabled={isLoading}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50 placeholder:text-zinc-500 text-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 text-zinc-400 hover:text-indigo-400 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenAssistant;
