import React, { useState, useEffect, useRef } from 'react';
import { SavedRecord } from '../types';
import PlatformCard from './PlatformCard';

const HistoryView: React.FC = () => {
  const [history, setHistory] = useState<SavedRecord[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ usedKB: number, percentage: number }>({ usedKB: 0, percentage: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Approx 5MB for local storage usually
  const MAX_STORAGE_BYTES = 5 * 1024 * 1024; 

  useEffect(() => {
    loadHistoryAndUsage();
  }, []);

  const loadHistoryAndUsage = () => {
    try {
      const savedData = localStorage.getItem('travel_history');
      if (savedData) {
        setHistory(JSON.parse(savedData));
      } else {
        setHistory([]);
      }
      
      // Calculate usage
      let totalBytes = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalBytes += (localStorage[key].length + key.length) * 2; // char is 2 bytes
        }
      }
      const usedKB = Math.round(totalBytes / 1024);
      const percentage = Math.min((totalBytes / MAX_STORAGE_BYTES) * 100, 100);
      setStorageUsage({ usedKB, percentage });

    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('確定要刪除這筆紀錄嗎？此動作無法復原。')) {
      const newHistory = history.filter(item => item.id !== id);
      setHistory(newHistory);
      localStorage.setItem('travel_history', JSON.stringify(newHistory));
      if (expandedId === id) setExpandedId(null);
      loadHistoryAndUsage(); // Recalculate usage
    }
  };

  const handleClearAll = () => {
    if (window.confirm('⚠️ 警告：這將會刪除「所有」旅遊紀錄，動作無法復原！\n\n建議您先執行「匯出備份」。\n\n確定要清空嗎？')) {
      localStorage.removeItem('travel_history');
      setHistory([]);
      setExpandedId(null);
      loadHistoryAndUsage();
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Export functionality
  const handleExport = () => {
    if (history.length === 0) {
      alert("目前沒有紀錄可供匯出");
      return;
    }
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TravelFlow_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import functionality
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);

        if (!Array.isArray(parsedData)) {
          throw new Error("格式錯誤：檔案內容必須是陣列");
        }

        // Basic validation checking if it looks like a record
        const isValidRecord = (item: any) => item && item.id && item.results;
        if (parsedData.length > 0 && !isValidRecord(parsedData[0])) {
           throw new Error("格式錯誤：無法識別的紀錄格式");
        }

        // Merge logic: Filter out duplicates based on ID
        const existingIds = new Set(history.map(h => h.id));
        const newRecords = parsedData.filter((item: SavedRecord) => !existingIds.has(item.id));

        if (newRecords.length === 0) {
          alert("匯入的資料已存在，無需更新。");
        } else {
          const mergedHistory = [...newRecords, ...history].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          
          setHistory(mergedHistory);
          localStorage.setItem('travel_history', JSON.stringify(mergedHistory));
          alert(`成功匯入 ${newRecords.length} 筆新紀錄！`);
          loadHistoryAndUsage();
        }
      } catch (err) {
        console.error(err);
        alert("匯入失敗：檔案格式不正確");
      } finally {
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 relative">
        <div className="text-6xl mb-4 opacity-20">📂</div>
        <h3 className="text-xl font-bold text-slate-600">目前沒有儲存的紀錄</h3>
        <p className="mt-2 mb-6">去生成一些精彩的旅遊文案並儲存下來吧！</p>
        
        {/* Allow import even when empty */}
        <button 
           onClick={handleImportClick}
           className="text-indigo-600 hover:text-indigo-700 underline text-sm"
        >
          我有備份檔，想要匯入紀錄
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImportFile} 
          accept=".json" 
          className="hidden" 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-slate-800">我的歷史紀錄</h2>
            <span className="text-sm text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
              共 {history.length} 筆
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap space-x-2 gap-y-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportFile} 
              accept=".json" 
              className="hidden" 
            />
            <button
              onClick={handleImportClick}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>匯入</span>
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-1 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>匯出備份</span>
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>清空</span>
            </button>
          </div>
        </div>
        
        {/* Storage Usage Bar */}
        <div className="bg-slate-100 rounded-full h-2.5 w-full overflow-hidden mt-2 relative group cursor-help">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              storageUsage.percentage > 90 ? 'bg-red-500' : 
              storageUsage.percentage > 70 ? 'bg-orange-400' : 'bg-green-500'
            }`}
            style={{ width: `${storageUsage.percentage}%` }}
          />
          {/* Tooltip */}
          <div className="absolute top-4 left-0 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded shadow border border-slate-200 z-10 whitespace-nowrap">
             已使用: {storageUsage.usedKB} KB / 5120 KB (約 {storageUsage.percentage.toFixed(1)}%)
          </div>
        </div>
        <div className="text-[10px] text-slate-400 text-right">
          儲存空間: {storageUsage.usedKB} KB ({storageUsage.percentage.toFixed(1)}%)
        </div>
      </div>

      <div className="grid gap-4">
        {history.map((record) => (
          <div 
            key={record.id} 
            className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${
              expandedId === record.id 
                ? 'border-indigo-200 shadow-lg ring-1 ring-indigo-50' 
                : 'border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md'
            }`}
          >
            {/* Header / Summary */}
            <div 
              onClick={() => toggleExpand(record.id)}
              className="p-5 cursor-pointer flex items-center justify-between bg-white"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-1">
                  <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {formatDate(record.date)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                     record.config.tone.includes('感性') ? 'bg-pink-50 text-pink-700 border-pink-100' :
                     record.config.tone.includes('幽默') ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                     record.config.tone.includes('實用') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                     'bg-purple-50 text-purple-700 border-purple-100'
                  }`}>
                    {record.config.tone}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 truncate pr-4">
                  {record.config.locationName || "未命名旅程"}
                </h3>
                <p className="text-sm text-slate-500 truncate mt-1">
                   {record.config.highlights || "沒有特別紀錄亮點..."}
                </p>
              </div>

              <div className="flex items-center space-x-3 pl-4 border-l border-slate-100">
                <button
                  onClick={(e) => handleDelete(record.id, e)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="刪除"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <div className={`transform transition-transform duration-300 text-slate-400 ${expandedId === record.id ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === record.id && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-6">
                
                {/* Original Inputs Summary */}
                <div className="mb-6 bg-white p-4 rounded-lg border border-slate-200 text-sm">
                  <h4 className="font-semibold text-slate-700 mb-2 border-b border-slate-100 pb-2">當時的設定</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600">
                    <div><span className="text-slate-400">地點：</span> {record.config.locationName || "-"}</div>
                    <div><span className="text-slate-400">風格：</span> {record.config.tone}</div>
                    <div className="col-span-1 md:col-span-2"><span className="text-slate-400">亮點：</span> {record.config.highlights || "-"}</div>
                    <div className="col-span-1 md:col-span-2"><span className="text-slate-400">感受：</span> {record.config.feelings || "-"}</div>
                    {record.config.customStyle && (
                       <div className="col-span-1 md:col-span-2 text-indigo-600"><span className="text-slate-400">客製：</span> {record.config.customStyle}</div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-slate-400 text-right">
                    * 僅儲存文字紀錄，圖片無法保存 (LocalStorage 限制)
                  </div>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {record.results.map((post, idx) => (
                    <div key={idx} className="h-full">
                       <PlatformCard post={post} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;