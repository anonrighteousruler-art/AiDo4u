import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Volume2, Activity, Menu, X, Settings as SettingsIcon, UserCircle } from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { getBehaviorPrompt } from '../utils/behavior';

interface LiveAudioProps {
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
}

const LiveAudio: React.FC<LiveAudioProps> = ({ isSidebarVisible, toggleSidebar }) => {
  const { settings, updateSettings } = useSettings();
  const audioSettings = settings['live-audio'];

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      mediaStreamRef.current = micStream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        const behaviorPrompt = getBehaviorPrompt(audioSettings.behaviorProfile, audioSettings.customBehaviorInstructions);
        ws.send(JSON.stringify({
          type: 'setup',
          voice: audioSettings.voiceName,
          systemInstruction: `You are a helpful, conversational AI assistant. Keep your responses concise and natural for a spoken conversation. ${behaviorPrompt}`
        }));
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
          startMicCapture();
        } else if (msg.type === 'audio') {
          playAudioChunk(msg.data);
        } else if (msg.type === 'interrupted') {
          nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
        } else if (msg.type === 'error') {
          setError(msg.message);
          stopSession();
        }
      };

      ws.onclose = () => stopSession();
      ws.onerror = (err) => {
        console.error("WS error:", err);
        setError("WebSocket connection failed.");
        stopSession();
      };

    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(err.message || 'Failed to access microphone.');
      setIsConnecting(false);
      stopSession();
    }
  };

  const startMicCapture = () => {
    if (!audioContextRef.current || !mediaStreamRef.current || !wsRef.current) return;
    const ctx = new AudioContext({ sampleRate: 16000 });
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
    (source as any).processor = processor;
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

  const stopSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 relative bg-zinc-950">
      <div className="absolute top-4 left-4 flex gap-2">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors z-50"
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

      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
        {isConnected && (
          <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-64 bg-indigo-500 rounded-full blur-3xl animate-pulse" />
          </div>
        )}

        <div className="mb-8 relative z-10">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
            isConnected 
              ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_40px_rgba(99,102,241,0.3)]' 
              : 'bg-zinc-800 text-zinc-500'
          }`}>
            {isConnecting ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : isConnected ? (
              <Volume2 className="w-10 h-10 animate-pulse" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </div>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 mb-2 relative z-10">
          {isConnecting ? 'Connecting...' : isConnected ? 'Listening...' : 'Live Audio Conversation'}
        </h2>
        <p className="text-zinc-400 text-sm mb-10 max-w-xs relative z-10">
          {isConnected 
            ? 'Speak naturally. Gemini is listening and will respond with voice.' 
            : 'Start a real-time voice conversation with Gemini. Now powered by full-stack WebSocket bridge.'}
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm w-full relative z-10">
            {error}
          </div>
        )}

        <button
          onClick={isConnected ? stopSession : startSession}
          disabled={isConnecting}
          className={`relative z-10 w-full py-4 rounded-xl font-medium text-lg flex items-center justify-center gap-3 transition-all ${
            isConnected
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
              : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
          } disabled:opacity-50`}
        >
          {isConnected ? <><MicOff className="w-5 h-5" /> End</> : <><Mic className="w-5 h-5" /> Start</>}
        </button>
      </div>

      {showSettings && (
        <div className="absolute inset-x-8 top-20 bottom-8 bg-zinc-950 border border-zinc-800 rounded-3xl z-40 p-8 flex flex-col gap-6 shadow-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-zinc-100">Live Audio Settings</h2>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-6 h-6" /></button>
          </div>
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400">Voice Persona</label>
              <select 
                value={audioSettings.voiceName}
                onChange={(e) => updateSettings('live-audio', { voiceName: e.target.value })}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-200"
              >
                <option value="Zephyr">Zephyr (Neutral/Helpful)</option>
                <option value="Puck">Puck (Cheerful/Quick)</option>
                <option value="Kore">Kore (Professional/Clear)</option>
                <option value="Charon">Charon (Deep/Serious)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <UserCircle className="w-4 h-4" /> Behavior Profile
              </label>
              <select 
                value={audioSettings.behaviorProfile}
                onChange={(e) => updateSettings('live-audio', { behaviorProfile: e.target.value as any })}
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

            {audioSettings.behaviorProfile === 'custom' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-400">Custom Behavior Instructions</label>
                <textarea 
                  value={audioSettings.customBehaviorInstructions}
                  onChange={(e) => updateSettings('live-audio', { customBehaviorInstructions: e.target.value })}
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

export default LiveAudio;
