import React, { useState, useEffect } from 'react';

interface EmojiEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmojis: string[];
  onSave: (emojis: string[]) => void;
}

// Synced with App.tsx
const DEFAULT_EMOJIS = [
  '✨', '❤️', '✈️', '📸', '🌊', '🌸', '🍜', '🥺', '🔥', '😂', '🥰', '🙏',
  '🍱', '🥂', '🏞️', '🏰', '🚆', '🚲', '💡', '⭐', '🎒', '🕶️', '🌞', '🌧️',
  '☕', '🍰', '🍻', '🛍️', '💃', '🕺', '🤳', '🤩', '😭', '🙌', '🎉', '🌟'
];

const EmojiEditorModal: React.FC<EmojiEditorModalProps> = ({ isOpen, onClose, currentEmojis, onSave }) => {
  const [editedEmojis, setEditedEmojis] = useState<string[]>([]);
  const [newEmojiInput, setNewEmojiInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEditedEmojis([...currentEmojis]);
    }
  }, [isOpen, currentEmojis]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newEmojiInput.trim()) {
      // Split by characters to handle pasted strings (Array.from handles surrogate pairs correctly)
      const inputEmojis = Array.from(newEmojiInput.trim()) as string[];
      
      // Filter out basic whitespace and duplicates within the input itself, and against existing
      const uniqueNew = inputEmojis.filter((e, idx, self) => {
        const isNotWhitespace = e.trim() !== '';
        const isUniqueInInput = self.indexOf(e) === idx;
        const isNotAlreadyInList = !editedEmojis.includes(e);
        return isNotWhitespace && isUniqueInInput && isNotAlreadyInList;
      });
      
      if (uniqueNew.length > 0) {
        setEditedEmojis(prev => [...prev, ...uniqueNew]);
      }
      setNewEmojiInput('');
    }
  };

  const handleRemove = (index: number) => {
    setEditedEmojis(prev => {
      const newList = [...prev];
      newList.splice(index, 1);
      return newList;
    });
  };

  const handleReset = () => {
    setEditedEmojis([...DEFAULT_EMOJIS]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 transform transition-all scale-100 border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg text-lg">😀</span>
            <h3 className="text-xl font-bold text-slate-800">編輯常用 Emoji</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">新增 Emoji</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newEmojiInput}
              onChange={(e) => setNewEmojiInput(e.target.value)}
              placeholder="輸入或貼上 Emoji..."
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newEmojiInput.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              加入
            </button>
          </div>
          <p className="text-xs text-slate-400">💡 提示：您可以一次貼上多個符號</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-end mb-2">
            <label className="text-sm font-medium text-slate-700">目前列表 ({editedEmojis.length})</label>
            <button 
              onClick={handleReset}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
            >
              恢復預設值
            </button>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 min-h-[120px] max-h-[200px] overflow-y-auto flex flex-wrap gap-2 content-start custom-scrollbar">
             {editedEmojis.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 py-4">
                  <span>列表是空的</span>
                </div>
             ) : (
                editedEmojis.map((emoji, idx) => (
                  <div key={idx} className="group relative inline-flex items-center justify-center w-10 h-10 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-300 transition-all">
                    <span className="text-xl leading-none">{emoji}</span>
                    <button
                      onClick={() => handleRemove(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 transform hover:scale-110"
                    >
                      ✕
                    </button>
                  </div>
                ))
             )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={() => {
              onSave(editedEmojis);
              onClose();
            }}
            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 text-sm"
          >
            儲存變更
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmojiEditorModal;