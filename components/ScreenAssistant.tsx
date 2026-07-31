import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MonitorUp, MonitorOff, Send, Loader2, Image as ImageIcon, MousePointer2, Keyboard, Info, Save, MessageSquare, Menu, X, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, Mic, MicOff, Settings as SettingsIcon, Volume2, Palette, ChevronDown, UserCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSettings } from '../SettingsContext';
import { getBehaviorPrompt } from '../utils/behavior';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  type?: 'text' | 'voice';
}

const ScreenAssistant: React.FC<{ isSidebarVisible: boolean; toggleSidebar: () => void }> = ({ isSidebarVisible, toggleSidebar }) => {
  const { settings, updateSettings } = useSettings();
  const screenSettings = settings.screen;

  const [isSharing, setIsSharing] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Hi! I am your Screen-Sharing AI Assistant. I can now guide you via live voice conversation. Click "Start Sharing" and "Start Voice" to begin.',
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

  // Live Audio State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio/WS Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const autoCaptureIntervalRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSharing();
      stopVoice();
    };
  }, []);

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
    if (autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current);
    }
  };

  const captureFrame = useCallback((): string | null => {
    if (!isSharing || !videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (highlightBox && highlightBox.w > 2 && highlightBox.h > 2) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      const pxX = (highlightBox.x / 100) * canvas.width;
      const pxY = (highlightBox.y / 100) * canvas.height;
      const pxW = (highlightBox.w / 100) * canvas.width;
      const pxH = (highlightBox.h / 100) * canvas.height;
      ctx.strokeRect(pxX, pxY, pxW, pxH);
    }

    return canvas.toDataURL('image/jpeg', 0.6); // Lower quality for faster transmission
  }, [isSharing, highlightBox]);

  const startVoice = async () => {
    try {
      setIsVoiceConnecting(true);
      
      // Setup Audio Context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Mic Access
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      mediaStreamRef.current = micStream;

      // WebSocket Connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        const behaviorPrompt = getBehaviorPrompt(screenSettings.behaviorProfile, screenSettings.customBehaviorInstructions);
        ws.send(JSON.stringify({
          type: 'setup',
          voice: screenSettings.voiceName,
          systemInstruction: `You are a real-time screen guidance AI. You can see the user's screen frames. 
Analyze the visual input and provide spoken guidance. 
If you see something the user should interact with, explain it clearly.
Format your thoughts for visual assistance too. 
Always look for Bounding Boxes (BBOX) and interaction points.
Keep responses concise and conversational.
${behaviorPrompt}`
        }));
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          setIsVoiceActive(true);
          setIsVoiceConnecting(false);
          startMicCapture();
          startAutoScreenCapture();
        } else if (msg.type === 'audio') {
          playAudioChunk(msg.data);
        } else if (msg.type === 'text') {
          // Append voice transcriptions to chat
          setMessages(prev => [...prev, { role: 'assistant', text: msg.data, type: 'voice' }]);
        } else if (msg.type === 'interrupted') {
          // Clear playback queue (simplistic implementation)
          nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
        }
      };

      ws.onclose = () => stopVoice();
      ws.onerror = (err) => console.error("WS error:", err);

    } catch (err) {
      console.error("Failed to start voice:", err);
      setIsVoiceConnecting(false);
    }
  };

  const stopVoice = () => {
    if (wsRef.current) wsRef.current.close();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    wsRef.current = null;
    mediaStreamRef.current = null;
    audioContextRef.current = null;
    setIsVoiceActive(false);
    setIsVoiceConnecting(false);
    if (autoCaptureIntervalRef.current) clearInterval(autoCaptureIntervalRef.current);
  };

  const startMicCapture = () => {
    if (!audioContextRef.current || !mediaStreamRef.current || !wsRef.current) return;
    const ctx = new AudioContext({ sampleRate: 16000 }); // Dedicated capture context
    const source = ctx.createMediaStreamSource(mediaStreamRef.current);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
      wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  };

  const startAutoScreenCapture = () => {
    if (autoCaptureIntervalRef.current) clearInterval(autoCaptureIntervalRef.current);
    autoCaptureIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && isSharing) {
        const frame = captureFrame();
        if (frame) {
          const base64 = frame.split(',')[1];
          wsRef.current.send(JSON.stringify({ type: 'video', data: base64 }));
        }
      }
    }, screenSettings.autoCaptureRate || 2000);
  };

  const playAudioChunk = async (base64Audio: string) => {
    if (!audioContextRef.current) return;
    const binaryString = atob(base64Audio);
    const int16Array = new Int16Array(new Uint8Array([...binaryString].map(c => c.charCodeAt(0))).buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768.0;

    const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    const currentTime = audioContextRef.current.currentTime;
    if (nextPlayTimeRef.current < currentTime) nextPlayTimeRef.current = currentTime;
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSharing || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setStartPos({ x, y });
    setHighlightBox({ x, y, w: 0, h: 0 });
    setIsDrawing(true);
    setAgentActions([]);
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

  const handleMouseUp = () => setIsDrawing(false);

  const handleSendText = () => {
    if (!input.trim() || !wsRef.current) return;
    if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'text', data: input }));
        setMessages(prev => [...prev, { role: 'user', text: input, type: 'text' }]);
        setInput('');
    }
  };

  const chatterStyles: Record<string, string> = {
    standard: "bg-zinc-900 text-zinc-200 border border-zinc-800",
    glass: "bg-white/5 backdrop-blur-lg border border-white/10 text-white shadow-xl",
    neo: "bg-indigo-600/10 border-2 border-indigo-500/50 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.15)]",
    minimal: "bg-transparent border-l-2 border-indigo-500 rounded-none pl-4 text-zinc-300",
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Left Panel: Screen View */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 p-4 relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
             <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Toggle Sidebar"
            >
              {isSidebarVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
              <MonitorUp className="w-5 h-5 text-indigo-400" />
              Screen Assistant
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'}`}
              title="Assistant Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsChatVisible(!isChatVisible)}
              className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Toggle Chat Panel"
            >
              {isChatVisible ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
            <div className="h-6 w-px bg-zinc-800 mx-1" />
            <button
              onClick={isVoiceActive ? stopVoice : startVoice}
              disabled={isVoiceConnecting}
              className={`px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                isVoiceActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              } disabled:opacity-50`}
            >
              {isVoiceConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : isVoiceActive ? <Volume2 className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
              {isVoiceActive ? 'Voice Active' : 'Start Voice'}
            </button>
            <button
              onClick={isSharing ? stopSharing : startSharing}
              className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                isSharing 
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' 
                  : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
              }`}
            >
              {isSharing ? <MonitorOff className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
              {isSharing ? 'Stop' : 'Share'}
            </button>
          </div>
        </div>

        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden relative flex items-center justify-center">
          {!isSharing && (
            <div className="text-center text-zinc-500 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
                <MonitorUp className="w-8 h-8 opacity-50" />
              </div>
              <p className="font-medium text-zinc-300">Ready to assist you.</p>
              <p className="text-sm opacity-75 max-w-xs">Share your screen and start a voice conversation for hands-free guidance.</p>
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
                  {/* Small triangle pointing down */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-indigo-600" />
                </div>
              </div>
            ))}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Settings Panel Overlay */}
        {showSettings && (
          <div className="absolute inset-x-4 top-20 bottom-4 bg-zinc-950/95 backdrop-blur-sm border border-zinc-800 rounded-xl z-40 p-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
               <h2 className="text-lg font-semibold flex items-center gap-2 text-indigo-400">
                <SettingsIcon className="w-5 h-5" /> Screen Assistant Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pr-2">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Voice & Interaction</h3>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-zinc-300">Voice Persona</label>
                  <select 
                    value={screenSettings.voiceName}
                    onChange={(e) => updateSettings('screen', { voiceName: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm"
                  >
                    <option value="Zephyr">Zephyr (Neutral/Helpful)</option>
                    <option value="Puck">Puck (Cheerful/Quick)</option>
                    <option value="Kore">Kore (Professional/Clear)</option>
                    <option value="Charon">Charon (Deep/Serious)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-zinc-300 flex items-center gap-2">
                    <UserCircle className="w-4 h-4" /> Behavior Profile
                  </label>
                  <select 
                    value={screenSettings.behaviorProfile}
                    onChange={(e) => updateSettings('screen', { behaviorProfile: e.target.value as any })}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm"
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

                {screenSettings.behaviorProfile === 'custom' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-zinc-300">Custom Behavior Instructions</label>
                    <textarea 
                      value={screenSettings.customBehaviorInstructions}
                      onChange={(e) => updateSettings('screen', { customBehaviorInstructions: e.target.value })}
                      placeholder="e.g. Speak like a pirate, be very sarcastic, etc."
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm h-20 resize-none"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-zinc-200">Hands-Free Mode</span>
                    <span className="text-xs text-zinc-500">Auto-transmits audio without push-to-talk</span>
                  </div>
                  <button 
                    onClick={() => updateSettings('screen', { handsFreeMode: !screenSettings.handsFreeMode })}
                    className={`w-12 h-6 rounded-full transition-all relative ${screenSettings.handsFreeMode ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${screenSettings.handsFreeMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Vision Engine</h3>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-zinc-300 flex justify-between">
                    <span>Frame Rate (Refresh Rate)</span>
                    <span className="text-indigo-400">{(screenSettings.autoCaptureRate / 1000).toFixed(1)}s</span>
                  </label>
                  <input 
                    type="range" min="1000" max="5000" step="500"
                    value={screenSettings.autoCaptureRate}
                    onChange={(e) => updateSettings('screen', { autoCaptureRate: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                  <p className="text-[10px] text-zinc-500">Lower values provide more real-time guidance but increase data usage.</p>
                </div>
              </div>
            </div>
            
            <div className="mt-auto pt-6 border-t border-zinc-800 flex justify-end">
               <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600">Save Changes</button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Chat Interface (Chatterbox) */}
      {isChatVisible && (
        <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col bg-zinc-950 h-full border-l border-zinc-800 relative">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/30 flex justify-between items-center">
            <h2 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Chatterbox
            </h2>
            
            <div className="relative">
              <button 
                onClick={() => setShowStyleMenu(!showStyleMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="capitalize">{screenSettings.chatterboxStyle}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showStyleMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                  {Object.keys(chatterStyles).map(style => (
                    <button
                      key={style}
                      onClick={() => {
                        updateSettings('screen', { chatterboxStyle: style as any });
                        setShowStyleMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors capitalize"
                    >
                      {style}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col max-w-[90%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div 
                  className={`px-4 py-3 rounded-2xl transition-all duration-300 ${chatterStyles[screenSettings.chatterboxStyle]} ${
                    msg.role === 'user' 
                      ? 'rounded-br-sm' 
                      : 'rounded-bl-sm'
                  } ${msg.type === 'voice' ? 'border-indigo-500/30' : ''}`}
                >
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.type === 'voice' && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-400 font-medium uppercase tracking-widest opacity-70">
                      <Volume2 className="w-3 h-3" /> Transcribed Audio
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
            <div className="flex flex-col gap-3">
               {isVoiceActive && (
                  <div className="flex items-center justify-center gap-2 py-1 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                    <div className="flex gap-0.5 h-3 items-end">
                       {[0.4, 0.7, 0.5, 0.9, 0.3, 0.6].map((h, i) => (
                         <div key={i} className="w-1 bg-emerald-400 animate-pulse" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.1}s` }} />
                       ))}
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">Hands-Free Active</span>
                  </div>
               )}
               
               <div className="relative flex items-center">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                    placeholder="Paste links or type fallback message..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                  />
                  <button
                    onClick={handleSendText}
                    disabled={!input.trim()}
                    className="absolute right-2 p-2 text-zinc-400 hover:text-indigo-400 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenAssistant;
