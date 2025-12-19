import React, { useState, useEffect, useRef } from 'react';
import { SavedRecord } from '../types';
import PlatformCard from './PlatformCard';

const HistoryView: React.FC = () => {
  const [history, setHistory] = useState<SavedRecord[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ usedKB: number, percentage: number }>({ usedKB: 0, percentage: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB limit

  useEffect(() => {
    loadHistoryAndUsage();
  }, []);

  const loadHistoryAndUsage = () => {
    try {
      const savedData = localStorage.getItem('travel_history');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Ensure we only keep valid records and sort them by date desc
        const validHistory = Array.isArray(parsed) 
          ? parsed.filter(item => item && item.id && (item.resultData || item.results))
          : [];
        setHistory(validHistory);
      } else {
        setHistory([]);
      }
      
      // Calculate real storage usage
      let totalBytes = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalBytes += (localStorage[key].length + key.length) * 2;
        }
      }
      const usedKB = Math.round(totalBytes / 1024);
      const percentage = Math.min((totalBytes / MAX_STORAGE_BYTES) * 100, 100);
      setStorageUsage({ usedKB, percentage });

    } catch (e) {
      console.error("Failed to load history", e);
      setHistory([]);
    }
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('確定要刪除這筆紀錄嗎？此動作無法復原。')) {
      const newHistory = history.filter(item => item.id !== id);
      setHistory(newHistory);
      localStorage.setItem('travel_history', JSON.stringify(newHistory));
      if (expandedId === id) setExpandedId(null);
      loadHistoryAndUsage();
    }
  };

  const handleClearAll = () => {
    if (window.confirm('⚠️ 警告：這將會刪除「所有」旅遊紀錄！\n\n確定要清空嗎？')) {
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
    try {
      return new Date(isoString).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return "未知日期";
    }
  };

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
        if (!Array.isArray(parsedData)) throw new Error("格式錯誤");
        
        const existingIds = new Set(history.map(h => h.id));
        const newRecords = parsedData.filter((item: any) => item.id && !existingIds.has(item.id));
        
        const merged = [...newRecords, ...history].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        localStorage.setItem('travel_history', JSON.stringify(merged));
        setHistory(merged);
        alert(`成功匯入 ${newRecords.length} 筆紀錄`);
        loadHistoryAndUsage();
      } catch (err) {
        alert("匯入失敗：格式不正確");
      }
    };
    reader.readAsText(file);
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="text-6xl mb-4 opacity-20">📂</div>
        <h3 className="text-xl font-bold text-slate-600">目前沒有儲存的紀錄</h3>
        <p className="text-sm mt-2">點擊「建立新貼文」開始創作</p>
        <button onClick={handleImportClick} className="mt-6 text-indigo-600 hover:text-indigo-700 underline text-sm font-medium">匯入備份檔 (.json)</button>
        <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
            我的歷史紀錄 <span className="ml-3 text-sm font-normal text-slate-500 bg-white px-2 py-1 rounded-md border">{history.length} 筆</span>
          </h2>
          <div className="mt-2 flex items-center space-x-2">
            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${storageUsage.percentage > 80 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                style={{ width: `${storageUsage.percentage}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-slate-400">儲存空間已使用 {storageUsage.usedKB}KB ({Math.round(storageUsage.percentage)}%)</span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={handleExport} className="px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-slate-50 shadow-sm transition-all active:scale-95">匯出備份</button>
          <button onClick={handleClearAll} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-all active:scale-95">清空全部</button>
        </div>
      </div>

      <div className="grid gap-4">
        {history.map((record) => {
          const analysis = record.resultData?.analysis || (record as any).analysis || { detectedName: record.config.locationName || "未命名地點", confidence: "N/A", evidence: "無分析資料" };
          const posts = record.resultData?.posts || (record as any).results || [];

          return (
            <div key={record.id} className={`bg-white rounded-xl border transition-all ${expandedId === record.id ? 'border-indigo-300 shadow-md ring-1 ring-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}>
              <div onClick={() => toggleExpand(record.id)} className="p-4 cursor-pointer flex items-center justify-between">
                <div className="flex-1 truncate">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[10px] text-slate-400">{formatDate(record.date)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">{record.config.tone}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 rounded text-indigo-500 font-medium">{record.config.model.split('-')[0].toUpperCase()}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 truncate">{analysis.detectedName}</h3>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <button onClick={(e) => handleDelete(record.id, e)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedId === record.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {expandedId === record.id && (
                <div className="p-4 border-t bg-slate-50/50 space-y-4 animate-fade-in">
                  <div className="bg-white p-4 rounded-xl border border-slate-100 text-xs space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                       <span className="font-bold text-slate-400 uppercase tracking-wider">AI 地點偵測</span>
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${analysis.confidence === 'HIGH' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>信心度: {analysis.confidence}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed"><span className="font-bold mr-1">分析依據:</span>{analysis.evidence}</p>
                    {analysis.mapsUrl && (
                      <a href={analysis.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-bold mt-1 group">
                         {analysis.mapsUrl.includes('google.com/maps') ? '🗺️ 開啟 Google Maps' : '🔗 查看參考來源'}
                         <svg className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {posts.map((post: any, idx: number) => <PlatformCard key={idx} post={post} />)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryView;