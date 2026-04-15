/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ScreenAssistant from './components/ScreenAssistant';
import LiveAudio from './components/LiveAudio';
import Chatbot from './components/Chatbot';
import MediaAnalysis from './components/MediaAnalysis';
import DataIndex from './components/DataIndex';
import { AppMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('screen');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {isSidebarVisible && <Sidebar currentMode={mode} setMode={setMode} />}
      <main className="flex-1 h-full relative overflow-hidden bg-zinc-900/50">
        {mode === 'screen' && <ScreenAssistant isSidebarVisible={isSidebarVisible} toggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} />}
        {mode === 'live-audio' && <LiveAudio isSidebarVisible={isSidebarVisible} toggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} />}
        {mode === 'chatbot' && <Chatbot isSidebarVisible={isSidebarVisible} toggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} />}
        {mode === 'media' && <MediaAnalysis isSidebarVisible={isSidebarVisible} toggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} />}
        {mode === 'index' && <DataIndex isSidebarVisible={isSidebarVisible} toggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} />}
      </main>
    </div>
  );
};

export default App;
