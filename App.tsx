/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ScreenAssistant from './components/ScreenAssistant';
import UnifiedChat from './components/UnifiedChat';
import MediaAnalysis from './components/MediaAnalysis';
import { AppMode } from './types';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('screen');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);

  return (
    <div className="flex h-screen w-full bg-[url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-black/40 backdrop-blur-xl border-r border-white/10`}>
        {isSidebarOpen && <Sidebar currentMode={mode} setMode={setMode} />}
      </div>
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="absolute top-4 left-4 z-50 p-2 bg-white/10 rounded-lg hover:bg-white/20">
        {isSidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
      </button>

      {/* Main Content */}
      <main className="flex-1 h-full relative overflow-hidden p-4 flex gap-4">
        <div className={`flex-1 h-full transition-all duration-300 ${isChatOpen ? 'w-1/2' : 'w-full'}`}>
          {mode === 'screen' && <ScreenAssistant />}
          {mode === 'media' && <MediaAnalysis />}
        </div>
        
        {/* Chat Panel */}
        <div className={`${isChatOpen ? 'w-1/3' : 'w-0'} transition-all duration-300`}>
          {isChatOpen && <UnifiedChat />}
        </div>
        <button onClick={() => setIsChatOpen(!isChatOpen)} className="absolute top-4 right-4 z-50 p-2 bg-white/10 rounded-lg hover:bg-white/20">
          {isChatOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </button>
      </main>
    </div>
  );
};

export default App;
