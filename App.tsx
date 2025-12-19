import React, { useState, useRef, useEffect } from 'react';
import { Platform, Tone, UploadedImage, GenerationResult, AIModel } from './types';
import { generateSocialContent } from './services/geminiService';
import PlatformCard from './components/PlatformCard';
import HistoryView from './components/HistoryView';
import EmojiEditorModal from './components/EmojiEditorModal';
import ChangelogModal, { APP_VERSION } from './components/ChangelogModal';

type ActiveView = 'generator' | 'history';

const DEFAULT_EMOJIS = [
  '✨', '❤️', '✈️', '📸', '🌊', '🌸', '🍜', '🥺', '🔥', '😂', '🥰', '🙏',
  '🍱', '🥂', '🏞️', '🏰', '🚆', '🚲', '💡', '⭐', '🎒', '🕶️', '🌞', '🌧️',
  '☕', '🍰', '🍻', '🛍️', '💃', '🕺', '🤳', '🤩', '😭', '🙌', '🎉', '🌟'
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
    } catch (e) { 
      alert("儲存失敗：空間不足。請至歷史紀錄清空舊資料。"); 
    }
  };

  const getModelDescription = (m: AIModel) => {
    if (m === AIModel.GEMINI_2_5_FLASH) return "⚡️ 快速穩定，整合 Google Maps 地圖工具。";
    if (m === AIModel.GEMINI_3_FLASH) return "🧠 推薦！智慧平衡，整合 Google Search 聯網搜尋工具。";
    return "💎 最強大腦，適合文藝創作者，支援深度聯網搜尋。";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveView('generator')}>
            <span className="text-2xl">✈️</span>
            <h1 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">TravelFlow AI</h1>
          </div>
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveView('generator')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${activeView === 'generator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>建立新貼文</button>
            <button onClick={() => setActiveView('history')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${activeView === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>我的紀錄</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {activeView === 'history' ? <HistoryView /> : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>上傳素材</h3>
                  <div className="flex items-center space-x-2">
                    {images.length > 0 && <button onClick={removeAllImages} className="text-xs text-red-400">清空</button>}
                    <span className="text-xs text-slate-500">{images.length}/{MAX_IMAGES}</span>
                  </div>
                </div>
                <div onClick={() => !isProcessingImages && images.length < MAX_IMAGES && fileInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-indigo-50 border-slate-300 transition-colors">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*,video/*" className="hidden" />
                  {isProcessingImages ? <p className="text-indigo-600 font-medium">正在壓縮處理...</p> : <p className="text-slate-500 font-medium">📸 點擊上傳照片或短片</p>}
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
                <h3 className="text-lg font-semibold mb-4 flex items-center"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>風格設定</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">AI 模型</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value as AIModel)} className="w-full rounded-lg border-slate-200 text-sm p-3 bg-slate-50 border focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value={AIModel.GEMINI_3_FLASH}>Gemini 3.0 Flash (智慧平衡)</option>
                    <option value={AIModel.GEMINI_2_5_FLASH}>Gemini 2.5 Flash (快速精準)</option>
                    <option value={AIModel.GEMINI_3_PRO}>Gemini 3.0 Pro (文藝創作)</option>
                  </select>
                  <div className="mt-2 text-[11px] text-indigo-700 bg-indigo-50/50 p-2 rounded leading-relaxed">{getModelDescription(selectedModel)}</div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">基礎語調</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(Tone).map(t => (
                      <button key={t} onClick={() => setSelectedTone(t)} className={`px-3 py-2 text-xs rounded-lg border transition-all ${selectedTone === t ? 'bg-indigo-600 border-indigo-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>{t}</button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">客製化要求 (選填)</label>
                    <button onClick={() => setIsEmojiModalOpen(true)} className="text-xs text-indigo-600 hover:underline">編輯常用符號</button>
                  </div>
                  <textarea value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} placeholder="例如：多加一點 Emoji、用日本女高中生語氣..." rows={2} className="w-full rounded-lg border-slate-200 text-sm p-3 bg-slate-50 border focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {commonEmojis.slice(0, 12).map((emoji, idx) => (
                      <button key={idx} onClick={() => addEmojiToStyle(emoji)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors text-lg">{emoji}</button>
                    ))}
                  </div>
                </div>

                <div className="mb-6 space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold text-slate-800">📝 旅遊細節</h4>
                  <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="📍 景點名稱 (留空讓 AI 偵測)" className="w-full rounded-lg border-slate-200 text-sm p-2.5 border bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="✨ 行程亮點 (必吃美食、特色風景...)" rows={2} className="w-full rounded-lg border-slate-200 text-sm p-2.5 border bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">發布平台</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(Platform).map((p) => (
                      <label key={p} className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all ${selectedPlatforms.includes(p) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                        <input type="checkbox" checked={selectedPlatforms.includes(p)} onChange={() => togglePlatform(p)} className="text-indigo-600 rounded focus:ring-indigo-500" />
                        <span className="text-xs font-medium text-slate-700">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={handleGenerate} disabled={isLoading || images.length === 0} className={`w-full py-4 rounded-xl shadow-lg text-white font-bold transition-all transform active:scale-95 ${isLoading ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-200 hover:brightness-110'}`}>
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>正在分析並撰寫文案...</span>
                    </div>
                  ) : "✨ 立即生成圖文"}
                </button>
                {error && <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 animate-fade-in">{error}</div>}
              </div>
            </div>

            <div className="lg:col-span-8">
              {generationResult ? (
                <div className="space-y-6 animate-fade-in-up">
                  <div className={`p-5 rounded-2xl border-2 flex items-start space-x-4 shadow-sm transition-all ${generationResult.analysis.confidence === 'HIGH' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="text-3xl filter drop-shadow-sm">🎯</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-lg">AI 地點偵測：{generationResult.analysis.detectedName}</h4>
                        {generationResult.analysis.mapsUrl && (
                          <a href={generationResult.analysis.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-200 hover:bg-indigo-50 font-bold transition-all shadow-sm active:scale-95">
                            {generationResult.analysis.mapsUrl.includes('google.com/maps') ? '🗺️ 在地圖中開啟' : '🔗 查看參考資料'}
                          </a>
                        )}
                      </div>
                      <p className="text-sm mt-2 opacity-90 leading-relaxed font-medium">{generationResult.analysis.evidence}</p>
                      <div className="mt-3 inline-flex items-center text-[10px] bg-white/60 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider border border-white/50">信心指數: {generationResult.analysis.confidence}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                     <h3 className="text-xl font-bold text-slate-800 flex items-center">
                       <span className="w-1.5 h-6 bg-indigo-600 rounded-full mr-3"></span>
                       生成結果
                     </h3>
                     <button onClick={handleSaveResult} disabled={isSaved} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 ${isSaved ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {isSaved ? "✓ 已儲存至紀錄" : "💾 儲存結果"}
                     </button>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {generationResult.posts.map((post, idx) => <PlatformCard key={idx} post={post} />)}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 min-h-[550px] text-slate-400 p-8 text-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-5xl">🌍</div>
                  <h4 className="text-xl font-bold text-slate-700 mb-2">準備好分享你的旅程了嗎？</h4>
                  <p className="text-sm max-w-sm leading-relaxed">上傳你的旅遊照片或影片，AI 將自動偵測地點並根據不同社群平台的特性撰寫專屬文案。</p>
                  <div className="mt-8 flex gap-4">
                    <div className="flex flex-col items-center space-y-1">
                      <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-bold">IG</div>
                      <span className="text-[10px]">吸睛文案</span>
                    </div>
                    <div className="flex flex-col items-center space-y-1">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">FB</div>
                      <span className="text-[10px]">詳盡報導</span>
                    </div>
                    <div className="flex flex-col items-center space-y-1">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">V</div>
                      <span className="text-[10px]">長文創作</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2024 TravelFlow AI - 讓回憶自動變為動人故事</p>
          <button onClick={() => setIsChangelogOpen(true)} className="px-3 py-1 bg-slate-100 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all font-medium">版本紀錄：{APP_VERSION}</button>
        </div>
      </footer>

      <EmojiEditorModal isOpen={isEmojiModalOpen} onClose={() => setIsEmojiModalOpen(false)} currentEmojis={commonEmojis} onSave={handleSaveEmojis} />
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
};

export default App;