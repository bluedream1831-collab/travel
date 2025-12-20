import React from 'react';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const APP_VERSION = 'v1.6.3';

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: 'v1.6.3',
    date: '2024-05-29',
    changes: [
      '🔔 新增 Toast 通知系統：存檔後將彈出提示，並提供「快速跳轉歷史紀錄」功能。',
      '✨ 視覺強化：存檔按鈕增加更明顯的狀態轉變，並在生成結果頁面加入跳轉連結。',
      '🚀 性能優化：優化了 LocalStorage 的數據存取速度。'
    ]
  },
  {
    version: 'v1.6.2',
    date: '2024-05-28',
    changes: [
      '💾 儲存機制優化：歷史紀錄現在不再儲存原始圖檔，有效避免 LocalStorage 空間爆滿。',
      '📊 空間監控：歷史紀錄頁面新增儲存空間進度條，隨時掌握剩餘容量。'
    ]
  },
  {
    version: 'v1.0.0',
    date: '2024-05-20',
    changes: [
      '🎉 正式發布 TravelFlow AI。'
    ]
  }
];

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">更新歷程</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-6 overflow-y-auto bg-white custom-scrollbar">
          <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
            {CHANGELOG_DATA.map((entry, idx) => (
              <div key={idx} className="relative pl-6">
                <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                <div className="flex justify-between mb-2">
                  <h4 className={`font-bold ${idx === 0 ? 'text-indigo-600' : 'text-slate-700'}`}>{entry.version}</h4>
                  <span className="text-xs text-slate-400">{entry.date}</span>
                </div>
                <ul className="space-y-1">
                  {entry.changes.map((change, cIdx) => (
                    <li key={cIdx} className="text-sm text-slate-600 flex items-start">
                      <span className="mr-2 mt-1.5 w-1 h-1 bg-slate-400 rounded-full flex-shrink-0"></span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ChangelogModal;