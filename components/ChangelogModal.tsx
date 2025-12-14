import React from 'react';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

// Define the changelog data here
export const APP_VERSION = 'v1.4.1';

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: 'v1.4.1',
    date: '2024-05-24',
    changes: [
      '🐛 修正格式問題：強制修復部分文案中出現「\\n」符號而未正確換行的問題。',
    ]
  },
  {
    version: 'v1.4.0',
    date: '2024-05-24',
    changes: [
      '🧵 新增 Threads 平台：支援生成「碎碎念、口語化」的 Threads 專屬貼文。',
      '✨ 文案優化：針對不同平台的語氣進行微調。'
    ]
  },
  {
    version: 'v1.3.0',
    date: '2024-05-23',
    changes: [
      '🚀 容量升級：照片/影片上傳上限增加至 20 個檔案。',
      '⚡️ 效能優化：即使多圖上傳也能保持流暢。'
    ]
  },
  {
    version: 'v1.2.0',
    date: '2024-05-23',
    changes: [
      '✨ 新增「一鍵清空」按鈕：可快速刪除所有已上傳的圖片與影片。',
      '🔧 系統優化：修正 Vite 建置與相依性衝突問題。',
      '📝 新增版本歷程紀錄頁面。'
    ]
  },
  {
    version: 'v1.1.0',
    date: '2024-05-22',
    changes: [
      '🎥 支援影片上傳：可上傳 MP4/MOV 短片，系統自動擷取畫面進行 AI 分析。',
      '🚀 擴充容量：上傳上限從 6 張增加至 10 張。',
      '🖼️ 介面優化：預覽圖新增影片識別圖示。'
    ]
  },
  {
    version: 'v1.0.0',
    date: '2024-05-20',
    changes: [
      '🎉 正式發布 TravelFlow AI 旅遊圖文生成器。',
      '🧠 整合 Google Gemini AI 進行視覺辨識與文案撰寫。',
      '📱 支援 Instagram, Facebook, 方格子, 痞客邦四種平台格式。',
      '💾 支援本機歷史紀錄儲存與匯出/匯入功能。'
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
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] border border-slate-100 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-bold text-slate-800">更新歷程</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
          <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
            {CHANGELOG_DATA.map((entry, idx) => (
              <div key={idx} className="relative pl-6">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                  <h4 className={`text-base font-bold ${idx === 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {entry.version}
                  </h4>
                  <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded">
                    {entry.date}
                  </span>
                </div>
                
                <ul className="space-y-2">
                  {entry.changes.map((change, cIdx) => (
                    <li key={cIdx} className="text-sm text-slate-600 leading-relaxed flex items-start">
                      <span className="mr-2 mt-1.5 w-1 h-1 bg-slate-400 rounded-full flex-shrink-0"></span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-xs text-slate-400">
            持續優化中，感謝您的使用與回饋 ❤️
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;