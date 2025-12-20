
import React, { useState, useRef, useEffect } from 'react';
import { Platform, Tone, UploadedImage, GenerationResult, AIModel, StylePreset } from './types';
import { generateSocialContent } from './services/geminiService';
import PlatformCard from './components/PlatformCard';
import HistoryView from './components/HistoryView';
import EmojiEditorModal from './components/EmojiEditorModal';
import ChangelogModal, { APP_VERSION } from './components/ChangelogModal';

type ActiveView = 'generator' | 'history';

const DEFAULT_EMOJIS = [
  '✨', '❤️', '✈️', '📸', '🌊', '🌸', '🍜', '🥺', '🔥', '😂', '🥰', '🙏',
  '🍱', '🥂', '🏞️', '🏰', '🚆', '🚲', '💡', '⭐', '🎒', '🕶️', '🌞', '🌧️',
  '☕', '🍰', '🍻', '🛍️', '💃', '🕺', '🤳', '🤩', '😭', '🙌', '🎉', '🌟',
  '🌵', '🏠', '🍋', '🍹', '🛶', '⛺', '🥨', '🌮', '🎈', '🎐', '🎐', '🧸'
];

const MAX_IMAGES = 20; 
const MAX_FILE_SIZE_MB = 50; 

const processFile = async (file: File): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const fileURL = URL.createObjectURL(file);
      video.src = fileURL;
      video.onloadeddata = () => { video.currentTime = Math.min(1.0, video.duration / 2); };
      video.onerror = () => { URL.revokeObjectURL(fileURL); reject(new Error("無法載入影片")); };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        let width = video.videoWidth;
        let height = video.videoHeight;
        const MAX_DIMENSION = 1536;
        if (width > height) { if (width > MAX_DIMENSION) { height = Math.round((height * MAX_DIMENSION) / width); width = MAX_DIMENSION; } }
        else { if (height > MAX_DIMENSION) { width = Math.round((width * MAX_DIMENSION) / height); height = MAX_DIMENSION; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ id: Math.random().toString(36).substring(7), base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', previewUrl: dataUrl, isVideo: true });
        } else { reject(new Error("Canvas failed")); }
        URL.revokeObjectURL(fileURL);
      };
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          const MAX_DIMENSION = 1536;
          if (width > height) { if (width > MAX_DIMENSION) { height = Math.round((height * MAX_DIMENSION) / width); width = MAX_DIMENSION; } }
          else { if (height > MAX_DIMENSION) { width = Math.round((width * MAX_DIMENSION) / height); height = MAX_DIMENSION; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve({ id: Math.random().toString(36).substring(7), base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', previewUrl: dataUrl, isVideo: false });
          } else { reject(new Error("Canvas failed")); }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  });
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('generator');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([Platform.INSTAGRAM]);
  const [selectedTone, setSelectedTone] = useState<Tone>(Tone.EMOTIONAL);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AIModel.GEMINI_3_FLASH);
  const [customStyle, setCustomStyle] = useState<string>('');
  const [stylePresets, setStylePresets] = useState<StylePreset[]>(() => {
    try { const saved = localStorage.getItem('style_presets'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [commonEmojis, setCommonEmojis] = useState<string[]>(() => {
    try { const saved = localStorage.getItem('user_emojis'); return saved ? JSON.parse(saved) : DEFAULT_EMOJIS; } catch { return DEFAULT_EMOJIS; }
  });
  const [isEmojiModalOpen, setIsEmojiModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [locationName, setLocationName] = useState<string>('');
  const [highlights, setHighlights] = useState<string>('');
  const [feelings, setFeelings] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingImages, setIsProcessingImages] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState({ title: '', sub: '' });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => console.log("Geolocation blocked or failed", err));
    }
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles = Array.from(event.target.files) as File[];
      const validFiles = newFiles.filter(f => f.size / (1024 * 1024) <= MAX_FILE_SIZE_MB);
      const remainingSlots = MAX_IMAGES - images.length;
      if (remainingSlots <= 0) return alert("上限20張");
      setIsProcessingImages(true);
      try {
        const processed = await Promise.all(validFiles.slice(0, remainingSlots).map(f => processFile(f)));
        setImages(prev => [...prev, ...processed]);
      } catch (e) { setError("處理失敗"); }
      finally { setIsProcessingImages(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    }
  };

  const removeImage = (id: string) => setImages(prev => prev.filter(img => img.id !== id));
  const removeAllImages = (e: React.MouseEvent) => { e.stopPropagation(); if (window.confirm("清空？")) setImages([]); };
  const togglePlatform = (p: Platform) => setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const addEmojiToStyle = (emoji: string) => setCustomStyle(prev => prev + emoji);
  const handleSaveEmojis = (newEmojis: string[]) => { setCommonEmojis(newEmojis); localStorage.setItem('user_emojis', JSON.stringify(newEmojis)); };

  const handleSaveStylePreset = () => {
    if (!customStyle.trim()) return;
    const cleanStyle = customStyle.trim();
    const name = cleanStyle.slice(0, 10) + (cleanStyle.length > 10 ? '...' : '');
    const newPreset = { id: Date.now().toString(), name, content: cleanStyle };
    const updated = [newPreset, ...stylePresets.filter(p => p.content !== cleanStyle)].slice(0, 10);
    setStylePresets(updated);
    localStorage.setItem('style_presets', JSON.stringify(updated));
    setToastMessage({ title: '風格已儲存', sub: '下次可直接點選使用' });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const deleteStylePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = stylePresets.filter(p => p.id !== id);
    setStylePresets(updated);
    localStorage.setItem('style_presets', JSON.stringify(updated));
  };

  const handleGenerate = async () => {
    if (images.length === 0 || selectedPlatforms.length === 0) return setError("請上傳照片並選擇平台");
    setIsLoading(true); setError(null); setGenerationResult(null); setIsSaved(false);
    try {
      const imageParts = images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
      const result = await generateSocialContent(imageParts, selectedPlatforms, selectedTone, customStyle, { locationName, highlights, feelings }, selectedModel, userLocation);
      setGenerationResult(result);
    } catch (err: any) { setError(`生成失敗：${err.message}`); }
    finally { setIsLoading(false); }
  };

  const handleSaveResult = () => {
    if (!generationResult) return;
    const record = { 
      id: Date.now(), 
      date: new Date().toISOString(), 
      config: { 
        model: selectedModel, 
        tone: selectedTone, 
        customStyle, 
        locationName, 
        highlights, 
        feelings, 
        platforms: selectedPlatforms 
      }, 
      resultData: generationResult 
    };
    try {
      const saved = localStorage.getItem('travel_history');
      const existing = saved ? JSON.parse(saved) : [];
      localStorage.setItem('travel_history', JSON.stringify([record, ...existing]));
      setIsSaved(true);
      setToastMessage({ title: '存檔成功！', sub: '已加入您的旅遊紀錄' });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    } catch (e) { 
      alert("儲存失敗：空間不足。"); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans flex flex-col">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 right-4 z-[100] animate-fade-in-down">
          <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 border border-indigo-400">
            <span className="text-xl">✅</span>
            <div>
              <p className="font-bold text-sm">{toastMessage.title}</p>
              {toastMessage.sub && <p className="text-xs opacity-90">{toastMessage.sub}</p>}
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveView('generator')}>
            <span className="text-2xl animate-bounce">✈️</span>
            <h1 className="text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">TravelFlow AI</h1>
          </div>
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveView('generator')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${activeView === 'generator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>建立新貼文</button>
            <button onClick={() => setActiveView('history')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${activeView === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>我的紀錄</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {activeView === 'history' ? <HistoryView /> : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>素材上傳</h3>
                  <span className="text-xs text-slate-500">{images.length}/{MAX_IMAGES}</span>
                </div>
                <div onClick={() => !isProcessingImages && images.length < MAX_IMAGES && fileInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-indigo-50 border-slate-300 transition-colors">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*,video/*" className="hidden" />
                  {isProcessingImages ? <p className="text-indigo-600 font-medium animate-pulse">正在處理媒體檔...</p> : <p className="text-slate-500 font-medium">📸 點擊選擇照片或短片</p>}
                </div>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {images.map((img) => (
                      <div key={img.id} className="relative aspect-square group">
                        <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover rounded-lg shadow-sm" />
                        <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-md">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>內容設定</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">AI 模型選擇</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value as AIModel)} className="w-full rounded-lg border-slate-200 text-sm p-3 bg-slate-50 border focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value={AIModel.GEMINI_3_FLASH}>Gemini 3.0 Flash</option>
                    <option value={AIModel.GEMINI_2_5_FLASH}>Gemini 2.5 Flash</option>
                    <option value={AIModel.GEMINI_3_PRO}>Gemini 3.0 Pro</option>
                  </select>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">客製化風格庫</label>
                    <button onClick={handleSaveStylePreset} disabled={!customStyle.trim()} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 disabled:opacity-50">💾 儲存目前要求</button>
                  </div>
                  <textarea value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} placeholder="例如：每段加星星符號、不用標題符號、用搞笑語氣..." rows={2} className="w-full rounded-lg border-slate-200 text-sm p-3 bg-slate-50 border focus:ring-2 focus:ring-indigo-500 outline-none mb-2" />
                  
                  {stylePresets.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {stylePresets.map(preset => (
                        <div key={preset.id} className="group relative">
                          <button onClick={() => setCustomStyle(preset.content)} className={`px-2 py-1 text-[10px] rounded-md border transition-all ${customStyle === preset.content ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                            {preset.name}
                          </button>
                          <button onClick={(e) => deleteStylePreset(e, preset.id)} className="absolute -top-1.5 -right-1.5 bg-red-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 grid grid-cols-8 gap-1">
                    {commonEmojis.slice(0, 16).map((emoji, idx) => (
                      <button key={idx} onClick={() => addEmojiToStyle(emoji)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-100 rounded hover:bg-indigo-50 text-lg">{emoji}</button>
                    ))}
                  </div>
                </div>

                <div className="mb-6 space-y-4 pt-4 border-t">
                  <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="📍 景點名稱 (或讓 AI 自動辨識)" className="w-full rounded-lg border-slate-200 text-sm p-2.5 border bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="✨ 行程特色亮點..." rows={2} className="w-full rounded-lg border-slate-200 text-sm p-2.5 border bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">生成平台</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(Platform).map((p) => (
                      <label key={p} className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer ${selectedPlatforms.includes(p) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                        <input type="checkbox" checked={selectedPlatforms.includes(p)} onChange={() => togglePlatform(p)} className="text-indigo-600 rounded" />
                        <span className="text-xs font-medium">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={handleGenerate} disabled={isLoading || images.length === 0} className={`w-full py-4 rounded-xl shadow-lg text-white font-bold transition-all ${isLoading ? 'bg-slate-300' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 active:scale-95'}`}>
                  {isLoading ? "🚀 正在進行深度創作..." : "✨ 立即生成圖文內容"}
                </button>
                {error && <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">{error}</div>}
              </div>
            </div>

            <div className="lg:col-span-8">
              {generationResult ? (
                <div className="space-y-8 animate-fade-in-up">
                  {/* 極致優化後的 AI 辨識結果卡片 */}
                  <div className="relative group overflow-hidden bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/20 shadow-2xl transition-all duration-500 hover:shadow-indigo-200/50">
                    {/* 頂部科技掃描線動畫 */}
                    <div className="scanner-line"></div>
                    
                    {/* 背景漸層點綴 */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all duration-700"></div>
                    <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="p-8 sm:p-10 relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
                      
                      {/* 雷達視覺區 */}
                      <div className="relative flex-shrink-0 flex items-center justify-center w-28 h-28">
                        <div className="radar-wave" style={{ animationDelay: '0s' }}></div>
                        <div className="radar-wave" style={{ animationDelay: '0.6s' }}></div>
                        <div className="radar-wave" style={{ animationDelay: '1.2s' }}></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl transform rotate-3 transition-transform group-hover:rotate-6"></div>
                        <div className="absolute inset-0.5 bg-white rounded-[1.6rem] flex items-center justify-center">
                          <span className="text-5xl drop-shadow-lg transform transition-transform group-hover:scale-110">🎯</span>
                        </div>
                      </div>

                      <div className="flex-1 text-center md:text-left space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-center md:justify-start gap-2">
                              <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-[0.2em] shadow-sm">AI Scan Active</span>
                              <div className="flex items-center gap-1.5 px-3 py-0.5 bg-white border border-slate-100 rounded-full shadow-sm">
                                <span className={`w-1.5 h-1.5 rounded-full ${generationResult.analysis.confidence === 'HIGH' ? 'bg-green-500 animate-pulse' : 'bg-orange-400'}`}></span>
                                <span className="text-[10px] font-bold text-slate-500 tracking-tight">信心度 {generationResult.analysis.confidence}</span>
                              </div>
                            </div>
                            <h4 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 group-hover:text-indigo-600 transition-colors">
                               {generationResult.analysis.detectedName}
                            </h4>
                          </div>

                          {generationResult.analysis.mapsUrl && (
                            <a 
                              href={generationResult.analysis.mapsUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="group/map flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all shadow-xl active:scale-95 hover:-translate-y-1"
                            >
                              <span className="tracking-wide">開啟導航地圖</span>
                              <svg className="w-5 h-5 transform transition-transform group-hover/map:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </a>
                          )}
                        </div>

                        <div className="relative">
                          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full hidden md:block"></div>
                          <div className="bg-white/40 p-5 rounded-2xl border border-white/60 shadow-inner">
                            <p className="text-slate-600 leading-relaxed text-base sm:text-lg font-medium italic opacity-90">
                              「{generationResult.analysis.evidence}」
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between px-2">
                     <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                       <span className="w-2.5 h-8 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full shadow-sm"></span>
                       社群內容草稿
                     </h3>
                     <button onClick={handleSaveResult} disabled={isSaved} className={`px-6 py-3 rounded-2xl text-sm font-black shadow-lg transition-all active:scale-95 ${isSaved ? 'bg-green-600 text-white shadow-green-100' : 'bg-white border-2 border-slate-100 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}>
                        {isSaved ? "✓ 已存入紀錄" : "💾 儲存所有版本"}
                     </button>
                  </div>

                  <div className="grid grid-cols-1 gap-8 pb-16">
                    {generationResult.posts.map((post, idx) => <PlatformCard key={idx} post={post} />)}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 min-h-[550px] text-slate-400 p-8 text-center animate-fade-in group hover:border-indigo-300 transition-colors">
                  <div className="relative w-40 h-40 mb-10">
                    <div className="absolute inset-0 bg-indigo-50 rounded-full animate-pulse group-hover:bg-indigo-100 transition-colors"></div>
                    <div className="absolute inset-4 bg-white rounded-full shadow-inner flex items-center justify-center text-7xl transform transition-transform group-hover:scale-110">🌍</div>
                  </div>
                  <h4 className="text-3xl font-black text-slate-800 mb-4">讓 AI 說出旅途的故事</h4>
                  <p className="text-base max-w-sm leading-relaxed text-slate-500 font-medium">上傳照片後，我們將運用視覺神經網路偵測地點，並為您打造最具風格的社群文案。</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t py-10 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="font-bold tracking-wide">© 2024 TravelFlow AI - 讓回憶自動變為動人故事</p>
          <div className="flex items-center space-x-6">
            <button onClick={() => setIsChangelogOpen(true)} className="px-6 py-2.5 bg-slate-100 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all font-black shadow-sm">版本紀錄 {APP_VERSION}</button>
          </div>
        </div>
      </footer>

      <EmojiEditorModal isOpen={isEmojiModalOpen} onClose={() => setIsEmojiModalOpen(false)} currentEmojis={commonEmojis} onSave={handleSaveEmojis} />
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
};

export default App;
