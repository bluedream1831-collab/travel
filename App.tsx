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
    const record = { id: Date.now(), date: new Date().toISOString(), config: { model: selectedModel, tone: selectedTone, customStyle, locationName, highlights, feelings, platforms: selectedPlatforms }, resultData: generationResult };
    try {
      const saved = localStorage.getItem('travel_history');
      localStorage.setItem('travel_history', JSON.stringify([record, ...(saved ? JSON.parse(saved) : [])]));
      setIsSaved(true);
    } catch (e) { alert("儲存空間不足"); }
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
                <div onClick={() => !isProcessingImages && images.length < MAX_IMAGES && fileInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-indigo-50 border-slate-300">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*,video/*" className="hidden" />
                  {isProcessingImages ? <p className="text-indigo-600">正在處理...</p> : <p className="text-slate-600">📸 點擊上傳照片或短片</p>}
                </div>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {images.map((img) => (
                      <div key={img.id} className="relative aspect-square group">
                        <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover rounded-lg" />
                        <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>設定與模型</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">AI 模型版本</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value as AIModel)} className="w-full rounded-lg border-slate-200 text-sm p-3 bg-slate-50">
                    <option value={AIModel.GEMINI_3_FLASH}>Gemini 3.0 Flash (推薦)</option>
                    <option value={AIModel.GEMINI_2_5_FLASH}>Gemini 2.5 Flash</option>
                    <option value={AIModel.GEMINI_3_PRO}>Gemini 3.0 Pro</option>
                  </select>
                  <div className="mt-2 text-xs text-indigo-700 bg-indigo-50 p-2 rounded">{getModelDescription(selectedModel)}</div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">基礎風格</label>
                  <select value={selectedTone} onChange={(e) => setSelectedTone(e.target.value as Tone)} className="w-full rounded-lg border-slate-200 text-sm p-3 bg-slate-50">
                    {Object.values(Tone).map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                  </select>
                </div>
                <div className="mb-6 space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold flex items-center">📝 旅遊細節</h4>
                  <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="📍 景點/地點名稱 (留空讓 AI 偵測)" className="w-full rounded-lg border-slate-200 text-sm p-2.5 border bg-slate-50" />
                  <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="✨ 行程亮點 (美食、設施...)" rows={2} className="w-full rounded-lg border-slate-200 text-sm p-2.5 border bg-slate-50" />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">平台</label>
                  <div className="space-y-1">
                    {Object.values(Platform).map((p) => (
                      <label key={p} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedPlatforms.includes(p)} onChange={() => togglePlatform(p)} className="text-indigo-600 rounded" />
                        <span className="text-sm">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button onClick={handleGenerate} disabled={isLoading || images.length === 0} className={`w-full py-3.5 rounded-xl shadow-lg text-white font-bold transition-all ${isLoading ? 'bg-slate-300' : 'bg-gradient-to-r from-indigo-600 to-purple-600'}`}>
                  {isLoading ? "生成中..." : "✨ 立即生成"}
                </button>
                {error && <p className="mt-4 text-xs text-red-600">{error}</p>}
              </div>
            </div>

            <div className="lg:col-span-8">
              {generationResult ? (
                <div className="space-y-6 animate-fade-in-up">
                  <div className={`p-5 rounded-2xl border-2 flex items-start space-x-4 ${generationResult.analysis.confidence === 'HIGH' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="text-3xl">🎯</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-lg">AI 地點偵測：{generationResult.analysis.detectedName}</h4>
                        {generationResult.analysis.mapsUrl && (
                          <a href={generationResult.analysis.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-200 hover:bg-indigo-50 font-bold transition-colors shadow-sm">
                            {generationResult.analysis.mapsUrl.includes('google.com/maps') ? '🗺️ 在地圖中開啟' : '🔗 查看參考資料'}
                          </a>
                        )}
                      </div>
                      <p className="text-sm mt-2 opacity-90 leading-relaxed">{generationResult.analysis.evidence}</p>
                      <div className="mt-3 inline-flex items-center text-[10px] bg-white/50 px-2 py-0.5 rounded uppercase font-bold tracking-wider">信心指數: {generationResult.analysis.confidence}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                     <h3 className="text-xl font-bold text-slate-800">生成結果</h3>
                     <button onClick={handleSaveResult} disabled={isSaved} className={`px-4 py-2 rounded-lg text-sm transition-all ${isSaved ? 'bg-green-100 text-green-700' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>
                        {isSaved ? "✓ 已儲存" : "💾 儲存"}
                     </button>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {generationResult.posts.map((post, idx) => <PlatformCard key={idx} post={post} />)}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 min-h-[500px] text-slate-400">
                  <div className="text-6xl mb-4 opacity-50">🌍</div>
                  <p className="text-lg font-medium">上傳照片，AI 將自動為您定位並撰寫</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t py-4 text-center text-xs text-slate-400">
        <p>TravelFlow AI <button onClick={() => setIsChangelogOpen(true)} className="hover:text-indigo-600 underline">{APP_VERSION}</button></p>
      </footer>
      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
};

export default App;