
import React, { useState, useEffect, useRef } from 'react';
import { SavedRecord, Platform } from '../types';
import PlatformCard from './PlatformCard';

const HistoryView: React.FC = () => {
  const [history, setHistory] = useState<SavedRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ usedKB: number, percentage: number }>({ usedKB: 0, percentage: 0 });

  const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB limit

  useEffect(() => {
    loadHistoryAndUsage();
  }, []);

  const loadHistoryAndUsage = () => {
    try {
      const savedData = localStorage.getItem('travel_history');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        const validHistory = Array.isArray(parsed) 
          ? parsed.filter(item => item && item.id && (item.resultData || item.results))
          : [];
        setHistory(validHistory);
      } else {
        setHistory([]);
      }
      
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

  const filteredHistory = history.filter(item => {
    const analysis = item.resultData?.analysis || (item as any).analysis;
    const name = (analysis?.detectedName || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const tone = (item.config.tone || '').toLowerCase();
    return name.includes(query) || tone.includes(query);
  });

  const getPlatformBadge = (p: Platform) => {
    switch (p) {
      case Platform.INSTAGRAM: return <span className="w-5 h-5 flex items-center justify-center bg-pink-100 text-pink-600 rounded text-[10px] font-bold">IG</span>;
      case Platform.FACEBOOK: return <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded text-[10px] font-bold">FB</span>;
      case Platform.THREADS: return <span className="w-5 h-5 flex items-center justify-center bg-slate-800 text-white rounded text-[10px] font-bold">TH</span>;
      case Platform.VOCUS: return <span className="w-5 h-5 flex items-center justify-center bg-orange-100 text-orange-600 rounded text-[10px] font-bold">方</span>;
      case Platform.PIXNET: return <span className="w-5 h-5 flex items-center justify-center bg-sky-100 text-sky-600 rounded text-[10px] font-bold">痞</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 頂部管理區 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              我的旅遊足跡 
              <span className="ml-3 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                {history.length} 趟旅程
              </span>
            </h2>
            <div className="mt-2 flex items-center space-x-2">
              <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${storageUsage.percentage > 80 ? 'bg-red-500' : 'bg-indigo-400'}`} 
                  style={{ width: `${storageUsage.percentage}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">已用空間 {storageUsage.usedKB}KB / 5MB</span>
            </div>
          </div>
          
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="搜尋地點或風格..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button onClick={handleClearAll} className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-all active:scale-95">清空全部</button>
        </div>
      </div>

      {/* 歷史列表 */}
      <div className="grid gap-4">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
            {searchQuery ? "找不到符合條件的紀錄" : "目前尚無旅程紀錄"}
          </div>
        ) : (
          filteredHistory.map((record) => {
            const analysis = record.resultData?.analysis || (record as any).analysis;
            const posts = record.resultData?.posts || (record as any).results || [];
            const isExpanded = expandedId === record.id;
            const recordDate = new Date(record.date);

            return (
              <div 
                key={record.id} 
                className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isExpanded ? 'border-indigo-400 shadow-xl ring-4 ring-indigo-50/50' : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                {/* 列表頭部 */}
                <div 
                  onClick={() => toggleExpand(record.id)} 
                  className={`p-5 cursor-pointer flex items-center justify-between transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                >
                  <div className="flex items-center space-x-4 flex-1 truncate">
                    <div className="hidden sm:flex flex-col items-center justify-center bg-slate-100 rounded-xl w-14 h-14 flex-shrink-0 text-slate-500 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase">{recordDate.toLocaleString('zh-TW', { month: 'short' })}</span>
                      <span className="text-xl font-bold">{recordDate.getDate()}</span>
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500 font-bold">{record.config.tone}</span>
                        <div className="flex -space-x-1">
                           {(record.config.platforms || []).map((p: any, i: number) => (
                             <div key={i} className="ring-2 ring-white rounded">
                               {getPlatformBadge(p)}
                             </div>
                           ))}
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg truncate">{analysis?.detectedName || "未命名景點"}</h3>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 ml-4">
                    <button 
                      onClick={(e) => handleDelete(record.id, e)} 
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <svg className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* 展開詳情 */}
                {isExpanded && (
                  <div className="p-6 border-t border-slate-100 bg-white space-y-8 animate-fade-in">
                    {/* 第一層：AI 分析 */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col md:flex-row md:items-start gap-6">
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-shrink-0 flex flex-col items-center justify-center w-full md:w-32">
                         <span className="text-xs text-slate-400 font-bold mb-1">AI 信心度</span>
                         <span className={`px-3 py-1 rounded-full text-xs font-bold ${analysis?.confidence === 'HIGH' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                           {analysis?.confidence}
                         </span>
                      </div>
                      <div className="flex-1 space-y-3">
                         <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">地點辨識依據</h4>
                         <p className="text-slate-700 leading-relaxed font-medium">{analysis?.evidence}</p>
                         {analysis?.mapsUrl && (
                           <a 
                             href={analysis.mapsUrl} 
                             target="_blank" 
                             rel="noreferrer" 
                             className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95 mt-2"
                           >
                             <span>{analysis.mapsUrl.includes('search') ? '🔍 搜尋此地點' : '🗺️ 查看實體地圖位置'}</span>
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                           </a>
                         )}
                      </div>
                    </div>

                    {/* 第二層：生成貼文列表 */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <span className="w-8 h-px bg-slate-200 flex-1"></span>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">已生成的社群文案</h4>
                        <span className="w-8 h-px bg-slate-200 flex-1"></span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {posts.map((post: any, idx: number) => (
                          <div key={idx} className="h-full transform hover:translate-y-[-4px] transition-transform duration-300">
                            <PlatformCard post={post} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 第三層：原始設定回顧 (選填) */}
                    <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4">
                       <div className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">使用模型: {record.config.model.split('-')[0]}</div>
                       {record.config.highlights && <div className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">亮點: {record.config.highlights}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistoryView;
