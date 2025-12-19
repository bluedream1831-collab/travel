import React from 'react';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const APP_VERSION = 'v1.6.1';

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: 'v1.6.1',
    date: '2024-05-27',
    changes: [
      '🛠️ 穩定性修復：解決 Gemini 3.0 與地圖工具的相容性問題。',
      '🤖 動態工具切換：現在系統會根據模型自動切換 Google Maps 或 Google Search 獲取資訊。',
      '🔍 解析優化：導入更強大的 JSON 提取機制，減少「無法解析回傳格式」的錯誤。',
      '📝 文案優化：修正部分模型可能在文案中混入 Markdown 標籤的問題。'
    ]
  },
  {
    version: 'v1.6.0',
    date: '2024-05-26',
    changes: [
      '🗺️ 地點偵測大升級：整合 Grounding 技術。',
      '📍 座標輔助：新增地理位置權限支援。'
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
        <div className="p-6 overflow-y-auto bg-white">
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