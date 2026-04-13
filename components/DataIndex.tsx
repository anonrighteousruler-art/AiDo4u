import React, { useState, useEffect } from 'react';
import { Save, Trash2, Link as LinkIcon, FileText } from 'lucide-react';

interface IndexedItem {
  id: string;
  timestamp: number;
  title: string;
  content: string;
  url?: string;
}

const DataIndex: React.FC = () => {
  const [items, setItems] = useState<IndexedItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('ai-data-index');
    if (saved) setItems(JSON.parse(saved));
  }, []);

  const saveItem = (title: string, content: string, url?: string) => {
    const newItem: IndexedItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      title,
      content,
      url
    };
    const updated = [newItem, ...items];
    setItems(updated);
    localStorage.setItem('ai-data-index', JSON.stringify(updated));
  };

  const deleteItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    localStorage.setItem('ai-data-index', JSON.stringify(updated));
  };

  return (
    <div className="h-full flex flex-col p-6 bg-zinc-950">
      <h2 className="text-2xl font-semibold text-zinc-100 mb-6">Data Index</h2>
      <div className="flex-1 overflow-y-auto space-y-4">
        {items.length === 0 && (
          <div className="text-center text-zinc-600 mt-20">No data indexed yet. Use the Screen Assistant to save snippets!</div>
        )}
        {items.map(item => (
          <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-zinc-200">{item.title}</h3>
              <button onClick={() => deleteItem(item.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-zinc-400 mb-2">{item.content}</p>
            {item.url && <a href={item.url} target="_blank" className="text-xs text-indigo-400 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Source</a>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataIndex;
