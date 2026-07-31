import React, { useState, useEffect } from 'react';
import { Save, Trash2, Link as LinkIcon, FileText, Menu, X, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '../SettingsContext';

interface IndexedItem {
  id: string;
  timestamp: number;
  title: string;
  content: string;
  url?: string;
}

interface DataIndexProps {
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
}

const DataIndex: React.FC<DataIndexProps> = ({ isSidebarVisible, toggleSidebar }) => {
  const { settings, updateSettings } = useSettings();
  const [items, setItems] = useState<IndexedItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ai-data-index');
    if (saved) setItems(JSON.parse(saved));
  }, []);

  const deleteItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    localStorage.setItem('ai-data-index', JSON.stringify(updated));
  };

  return (
    <div className="h-full flex flex-col p-6 bg-zinc-950 relative">
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

      <h2 className="text-2xl font-semibold text-zinc-100 mb-6 pl-12 flex items-center gap-3">
        <FileText className="w-6 h-6 text-indigo-400" /> Data Index
      </h2>
      
      <div className="flex-1 overflow-y-auto space-y-4 max-w-4xl mx-auto w-full">
        {items.length === 0 && (
          <div className="text-center text-zinc-600 mt-20 flex flex-col items-center gap-4">
             <FileText className="w-12 h-12 opacity-20" />
             <p>No data indexed yet. Use the Screen Assistant to save snippets!</p>
          </div>
        )}
        {items.map(item => (
          <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:bg-zinc-900 transition-all group">
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col">
                 <h3 className="font-semibold text-zinc-200">{item.title}</h3>
                 <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{new Date(item.timestamp).toLocaleString()}</span>
              </div>
              <button onClick={() => deleteItem(item.id)} className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-zinc-400 leading-relaxed mb-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
              {item.content}
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-2 font-medium">
                <LinkIcon className="w-3.5 h-3.5" /> View Source Origin
              </a>
            )}
          </div>
        ))}
      </div>

      {showSettings && (
        <div className="absolute inset-x-8 top-20 bottom-8 bg-zinc-950 border border-zinc-800 rounded-3xl z-40 p-8 flex flex-col gap-6 shadow-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-zinc-100">Index Settings</h2>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-6 h-6" /></button>
          </div>
          <div className="space-y-6">
            <p className="text-zinc-500 text-sm">The Data Index stores snippets and insights captured during your sessions. This data is stored locally in your browser.</p>
          </div>
          <button onClick={() => setShowSettings(false)} className="mt-auto py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600">Close</button>
        </div>
      )}
    </div>
  );
};

export default DataIndex;
