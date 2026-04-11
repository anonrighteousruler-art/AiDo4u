import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MonitorUp, MonitorOff, Send, Loader2, Image as ImageIcon, MousePointer2, Keyboard, Info, Video, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ScreenAssistant: React.FC = () => {
  const [isSharing, setIsSharing] = useState(false);
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

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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

  const startRecording = () => {
    if (!streamRef.current) return;
    
    recordedChunksRef.current = [];
    try {
      // Try to use webm with vp9, fallback to default if not supported
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? { mimeType: 'video/webm;codecs=vp9' } 
        : undefined;
        
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = `screen-recording-${new Date().toISOString().replace(/:/g, '-')}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Error starting recording:", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopSharing = () => {
    if (isRecording) {
      stopRecording();
    }
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
If the user asks where to click, how to find something, or what to type, you MUST respond with the exact bounding box of the target element.
Format your response exactly like this:
BBOX: [x, y, width, height] (where values are percentages 0-100 of the image width and height)
If they need to type something, also include:
TYPE: "the text to type"
Then provide a helpful explanation. Do not use markdown for the BBOX or TYPE lines.`
        }
      });

      const responseText = response.text || 'I could not generate a response.';
      
      // Parse for Agentic Vision coordinates
      const bboxMatch = responseText.match(/BBOX:\s*\[([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\]/);
      const typeMatch = responseText.match(/TYPE:\s*"([^"]+)"/);
      
      if (bboxMatch) {
        setAgentActions([{
          action: typeMatch ? 'TYPE' : 'CLICK',
          bbox: {
            x: parseFloat(bboxMatch[1]),
            y: parseFloat(bboxMatch[2]),
            w: parseFloat(bboxMatch[3]),
            h: parseFloat(bboxMatch[4])
          },
          text: typeMatch ? typeMatch[1] : undefined
        }]);
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
            {isSharing && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm animate-pulse' 
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    Record
                  </>
                )}
              </button>
            )}
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
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
                  {act.action === 'TYPE' ? <Keyboard className="w-3 h-3" /> : <MousePointer2 className="w-3 h-3" />}
                  {act.action === 'TYPE' ? `Type: "${act.text}"` : 'Click Here'}
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
    </div>
  );
};

export default ScreenAssistant;
