import React, { useState, useRef, useEffect } from 'react';
import { Platform, Tone, UploadedImage, GenerationResult } from './types';
import { generateSocialContent } from './services/geminiService';
import PlatformCard from './components/PlatformCard';
import HistoryView from './components/HistoryView';
import EmojiEditorModal from './components/EmojiEditorModal';
import ChangelogModal, { APP_VERSION } from './components/ChangelogModal';

type ActiveView = 'generator' | 'history';

// Expanded default emoji list
const DEFAULT_EMOJIS = [
  '✨', '❤️', '✈️', '📸', '🌊', '🌸', '🍜', '🥺', '🔥', '😂', '🥰', '🙏',
  '🍱', '🥂', '🏞️', '🏰', '🚆', '🚲', '💡', '⭐', '🎒', '🕶️', '🌞', '🌧️',
  '☕', '🍰', '🍻', '🛍️', '💃', '🕺', '🤳', '🤩', '😭', '🙌', '🎉', '🌟'
];

const MAX_IMAGES = 20; // Updated limit from 10 to 20
const MAX_FILE_SIZE_MB = 50; // Increased limit to accommodate video files input (we compress them anyway)

// Utility: Process file (Image or Video)
const processFile = async (file: File): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      // --- Video Handling: Extract Frame ---
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const fileURL = URL.createObjectURL(file);
      video.src = fileURL;

      // When video metadata is loaded, seek to 1 second (or 0.1 if short) to avoid black frames
      video.onloadeddata = () => {
         video.currentTime = Math.min(1.0, video.duration / 2);
      };

      video.onerror = () => {
        URL.revokeObjectURL(fileURL);
        reject(new Error("無法載入影片檔案"));
      };

      video.onseeked = () => {
        // Draw the current frame to canvas
        const canvas = document.createElement('canvas');
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        // Resize logic (Same as image)
        const MAX_DIMENSION = 1536;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64 = dataUrl.split(',')[1];
          
          URL.revokeObjectURL(fileURL); // Clean up
          resolve({
            id: Math.random().toString(36).substring(7),
            base64,
            mimeType: 'image/jpeg',
            previewUrl: dataUrl,
            isVideo: true
          });
        } else {
          URL.revokeObjectURL(fileURL);
          reject(new Error("Canvas context failed"));
        }
      };

    } else {
      // --- Image Handling ---
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIMENSION = 1536;

          if (width > height) {
            if (width > MAX_DIMENSION) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64 = dataUrl.split(',')[1];
            
            resolve({
              id: Math.random().toString(36).substring(7),
              base64,
              mimeType: 'image/jpeg',
              previewUrl: dataUrl,
              isVideo: false
            });
          } else {
             reject(new Error("Canvas context failed"));
          }
        };
        
        img.onerror = () => reject(new Error("Failed to load image for processing"));
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    }
  });
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('generator');

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([Platform.INSTAGRAM]);
  const [selectedTone, setSelectedTone] = useState<Tone>(Tone.EMOTIONAL);
  
  const [customStyle, setCustomStyle] = useState<string>('');
  
  const [stylePresets, setStylePresets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('style_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [commonEmojis, setCommonEmojis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('user_emojis');
      return saved ? JSON.parse(saved) : DEFAULT_EMOJIS;
    } catch {
      return DEFAULT_EMOJIS;
    }
  });
  const [isEmojiModalOpen, setIsEmojiModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  
  const [locationName, setLocationName] = useState<string>('');
  const [highlights, setHighlights] = useState<string>('');
  const [feelings, setFeelings] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingImages, setIsProcessingImages] = useState<boolean>(false);
  
  // Updated results state to hold full GenerationResult object
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('style_presets', JSON.stringify(stylePresets));
  }, [stylePresets]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setError(null);
      const newFiles = Array.from(event.target.files) as File[];
      
      // 1. Validate File Size
      const validFiles = newFiles.filter(file => {
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > MAX_FILE_SIZE_MB) {
          alert(`檔案 ${file.name} 太大了 (${sizeMB.toFixed(1)}MB)！為了效能，請上傳小於 ${MAX_FILE_SIZE_MB}MB 的檔案。`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) {
         if (fileInputRef.current) fileInputRef.current.value = '';
         return;
      }

      const remainingSlots = MAX_IMAGES - images.length;

      if (remainingSlots <= 0) {
        alert(`最多只能上傳 ${MAX_IMAGES} 個檔案喔！`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      let filesToProcess = validFiles;
      if (validFiles.length > remainingSlots) {
        alert(`提醒：您選了 ${validFiles.length} 個檔案，但只能再放 ${remainingSlots} 個，已自動保留前 ${remainingSlots} 個。`);
        filesToProcess = validFiles.slice(0, remainingSlots);
      }

      // Process images/videos immediately
      setIsProcessingImages(true);
      try {
        const processedImages = await Promise.all(
          filesToProcess.map(file => processFile(file))
        );
        setImages(prev => [...prev, ...processedImages]);
      } catch (e) {
        console.error(e);
        setError("檔案處理失敗，請確認圖片或影片格式是否正確。");
      } finally {
        setIsProcessingImages(false);
        // Reset input value
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (idToRemove: string) => {
    setImages(prev => prev.filter(img => img.id !== idToRemove));
  };

  const removeAllImages = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length === 0) return;
    
    if (window.confirm("確定要清空目前已上傳的所有照片與影片嗎？")) {
      setImages([]);
    }
  };

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const addEmojiToStyle = (emoji: string) => {
    setCustomStyle(prev => prev + emoji);
  };

  const handleSaveEmojis = (newEmojis: string[]) => {
    setCommonEmojis(newEmojis);
    localStorage.setItem('user_emojis', JSON.stringify(newEmojis));
  };

  const saveStylePreset = () => {
    if (!customStyle.trim()) return;
    if (stylePresets.includes(customStyle.trim())) {
      alert("這個風格已經儲存過了！");
      return;
    }
    setStylePresets(prev => [customStyle.trim(), ...prev]);
  };

  const applyStylePreset = (preset: string) => {
    setCustomStyle(preset);
  };

  const deleteStylePreset = (presetToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("確定要刪除這個常用風格嗎？")) {
      setStylePresets(prev => prev.filter(p => p !== presetToDelete));
    }
  };

  const handleGenerate = async () => {
    if (images.length === 0) {
      setError("請至少上傳一張照片或影片");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("請至少選擇一個發布平台");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGenerationResult(null);
    setIsSaved(false);

    try {
      const imageParts = images.map(img => ({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType
        }
      }));

      const result = await generateSocialContent(
        imageParts,
        selectedPlatforms,
        selectedTone,
        customStyle,
        {
          locationName,
          highlights,
          feelings
        }
      );
      setGenerationResult(result);
    } catch (err: any) {
      console.error("Generation Error in App:", err);
      
      let msg = "發生未預期的錯誤";
      
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'object' && err !== null) {
        try {
           const json = JSON.stringify(err);
           if (json === '{}' || json.includes('isTrusted')) {
             msg = "網絡或圖片資料錯誤，請嘗試重新整理頁面。";
           } else {
             msg = json;
           }
        } catch {
           msg = "未知錯誤物件";
        }
      } else if (typeof err === 'string') {
        msg = err;
      }

      if (msg.includes("400")) {
         setError("請求無效 (400) - 圖片可能被防火牆阻擋或格式無法辨識。");
      } else if (msg.includes("401") || msg.includes("API key")) {
         setError("API Key 設定有誤，請檢查 Vercel 環境變數。");
      } else if (msg.includes("429")) {
         setError("目前使用人數過多 (Quota Exceeded)，請稍後再試。");
      } else if (msg.includes("SAFETY")) {
         setError("生成的內容被安全過濾器攔截，請嘗試調整圖片或文字。");
      } else {
         setError(`生成失敗：${msg.substring(0, 150)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const downloadRecord = (record: any) => {
    const dataStr = JSON.stringify([record], null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TravelFlow_Post_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveResult = () => {
    if (!generationResult) return;

    const record = {
      id: Date.now(),
      date: new Date().toISOString(),
      config: {
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
      const savedData = localStorage.getItem('travel_history');
      let existingHistory = [];
      try {
        existingHistory = savedData ? JSON.parse(savedData) : [];
      } catch (e) {
        console.error("Error parsing history", e);
        existingHistory = [];
      }
      
      const newHistory = [record, ...existingHistory];
      
      localStorage.setItem('travel_history', JSON.stringify(newHistory));
      setIsSaved(true);
      
    } catch (e: any) {
      console.error("Save failed", e);
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        const shouldDownload = window.confirm(
          "⚠️ 瀏覽器儲存空間已滿 (Quota Exceeded)！\n\n無法將此紀錄存入「我的紀錄」。\n是否改為直接「下載備份檔」？"
        );
        
        if (shouldDownload) {
          downloadRecord(record);
          setIsSaved(true);
        }
      } else {
        alert("儲存發生未預期的錯誤");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveView('generator')}>
            <span className="text-2xl">✈️</span>
            {/* Show title on mobile but smaller */}
            <h1 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              TravelFlow AI
            </h1>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('generator')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                activeView === 'generator'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              建立新貼文
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center space-x-1 ${
                activeView === 'history'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>我的紀錄</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {activeView === 'history' ? (
          <HistoryView />
        ) : (
          /* Generator View */
          <>
            {/* Intro Section */}
            <div className="text-center mb-10 animate-fade-in-down">
              <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">
                讓 AI 為你的旅行說故事
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                上傳旅遊照片或簡單短片(Reels)，填寫記憶，一鍵生成社群專屬圖文。
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Controls & Upload */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Image/Video Upload Area */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                      上傳素材
                    </h3>
                    <div className="flex items-center space-x-2">
                      {images.length > 0 && (
                        <button
                          onClick={removeAllImages}
                          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center"
                          title="全部刪除"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          清空
                        </button>
                      )}
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        images.length >= MAX_IMAGES 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {images.length}/{MAX_IMAGES}
                      </span>
                    </div>
                  </div>
                  
                  <div 
                    onClick={() => {
                      if (!isProcessingImages) {
                        if (images.length < MAX_IMAGES) {
                          fileInputRef.current?.click();
                        } else {
                          alert(`已達到 ${MAX_IMAGES} 個檔案上限，請先刪除部分檔案再上傳。`);
                        }
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors group relative overflow-hidden ${
                      images.length >= MAX_IMAGES || isProcessingImages
                        ? 'border-slate-200 bg-slate-50 cursor-not-allowed' 
                        : 'border-slate-300 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      multiple 
                      accept="image/*,video/*" 
                      className="hidden" 
                      disabled={images.length >= MAX_IMAGES || isProcessingImages}
                    />
                    
                    {isProcessingImages ? (
                      <div className="flex flex-col items-center justify-center py-2">
                        <svg className="animate-spin h-8 w-8 text-indigo-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm text-indigo-600 font-medium">正在處理...</p>
                      </div>
                    ) : (
                      <>
                        <div className={`text-4xl mb-3 transition-transform ${images.length < MAX_IMAGES ? 'group-hover:scale-110' : 'opacity-50'}`}>📸</div>
                        <p className={`font-medium ${images.length >= MAX_IMAGES ? 'text-slate-400' : 'text-slate-600'}`}>
                          {images.length >= MAX_IMAGES ? '已達上傳上限' : '點擊上傳照片或短片'}
                        </p>
                        {images.length < MAX_IMAGES && (
                          <p className="text-xs text-slate-400 mt-1">最多 {MAX_IMAGES} 個檔案 (自動擷取影片畫面)</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Previews */}
                  {images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {images.map((img) => (
                        <div key={img.id} className="relative aspect-square group">
                          <img 
                            src={img.previewUrl} 
                            alt="preview" 
                            className="w-full h-full object-cover rounded-lg border border-slate-200"
                          />
                          {img.isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                               <div className="bg-black/50 rounded-full p-1">
                                 <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                   <path d="M8 5v14l11-7z" />
                                 </svg>
                               </div>
                            </div>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* --- CUSTOM EMOJI BUTTON --- */}
                <button
                  onClick={() => setIsEmojiModalOpen(true)}
                  className="w-full py-3 px-4 bg-white border border-slate-200 border-dashed hover:border-indigo-400 hover:text-indigo-600 text-slate-500 rounded-xl transition-all flex items-center justify-center space-x-2 group hover:bg-indigo-50/50 shadow-sm"
                >
                  <div className="bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 rounded-full w-7 h-7 flex items-center justify-center text-xs transition-colors">
                    ⚙️
                  </div>
                  <span className="text-sm font-medium">編輯常用 Emoji 庫</span>
                </button>

                {/* Configuration Area */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>
                    設定風格與平台
                  </h3>

                  {/* Tone Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">基礎風格</label>
                    <div className="relative">
                      <select
                        value={selectedTone}
                        onChange={(e) => setSelectedTone(e.target.value as Tone)}
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3 px-4 text-slate-700 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500 text-sm transition-colors cursor-pointer outline-none"
                      >
                        {Object.values(Tone).map((tone) => (
                          <option key={tone} value={tone}>
                            {tone}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Custom Style */}
                  <div className="mb-6">
                     <div className="flex justify-between items-end mb-2">
                       <label className="block text-xs font-medium text-slate-600">
                         ✨ 客製化風格 (您的個人品牌)
                       </label>
                     </div>

                     <div className="flex flex-wrap gap-2 mb-2">
                       {commonEmojis.map((emoji, idx) => (
                         <button
                           key={idx}
                           onClick={() => addEmojiToStyle(emoji)}
                           className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-lg transition-all active:scale-95"
                           type="button"
                           title="加入此表情符號"
                         >
                           {emoji}
                         </button>
                       ))}
                     </div>
                     
                     <div className="relative group">
                       <textarea
                         value={customStyle}
                         onChange={(e) => setCustomStyle(e.target.value)}
                         placeholder="例如：我是小資女，喜歡強調CP值；或是：我的語氣要像跟閨蜜聊天，多用Emoji..."
                         rows={2}
                         className="w-full rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-slate-50 focus:bg-white transition-colors placeholder:text-slate-300 pr-10"
                       />
                       <button
                         onClick={saveStylePreset}
                         disabled={!customStyle.trim()}
                         className="absolute right-2 bottom-2 text-slate-400 hover:text-indigo-600 bg-white hover:bg-indigo-50 p-1.5 rounded-lg border border-transparent hover:border-indigo-100 transition-colors"
                         title="將目前文字存為常用風格"
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M11 19V13H5V11H11V5H13V11H19V13H13V19H11Z" />
                         </svg>
                       </button>
                     </div>

                     {stylePresets.length > 0 && (
                       <div className="mt-3">
                         <p className="text-[10px] text-slate-400 mb-1.5 flex items-center justify-between">
                            <span>我的常用風格 (點擊套用)</span>
                         </p>
                         <div className="flex flex-wrap gap-2">
                           {stylePresets.map((preset, idx) => (
                             <div 
                               key={idx} 
                               className="inline-flex items-center max-w-full bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full border border-indigo-100 group cursor-pointer hover:bg-indigo-100 transition-colors"
                               onClick={() => applyStylePreset(preset)}
                             >
                               <span className="truncate max-w-[150px] mr-1" title={preset}>{preset}</span>
                               <button
                                 onClick={(e) => deleteStylePreset(preset, e)}
                                 className="text-indigo-400 hover:text-red-500 p-0.5 rounded-full"
                               >
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                   <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                 </svg>
                               </button>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                  </div>

                  {/* Platform Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">發布平台 (多選)</label>
                    <div className="space-y-2">
                      {Object.values(Platform).map((platform) => (
                        <label key={platform} className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(platform)}
                            onChange={() => togglePlatform(platform)}
                            className="h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                          />
                          <span className="text-slate-700 font-medium">{platform}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Info Section */}
                  <div className="mb-6 space-y-4">
                    <div className="border-t border-slate-100 pt-4">
                       <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                          <span className="mr-2">📝</span> 旅遊細節 (讓故事更像你)
                       </h4>
                       
                       <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">📍 景點/地點名稱</label>
                          <input
                            type="text"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            placeholder="若不確定，可留空 (AI 會嘗試讀取招牌/地標)"
                            className="w-full rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-slate-50 focus:bg-white transition-colors"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            留空可讓 AI 自動偵測。若照片/影片含招牌文字 (OCR)，準確度極高。
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">✨ 有趣亮點 (必吃美食、設施、記憶點)</label>
                          <textarea
                            value={highlights}
                            onChange={(e) => setHighlights(e.target.value)}
                            placeholder="例如：抹茶冰淇淋超好吃、雲霄飛車排隊很久但很值得..."
                            rows={2}
                            className="w-full rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-slate-50 focus:bg-white transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">❤️ 個人感受 (氛圍、心情、感想)</label>
                          <textarea
                            value={feelings}
                            onChange={(e) => setFeelings(e.target.value)}
                            placeholder="例如：夕陽很美讓人想哭、雖然腳很酸但很開心..."
                            rows={2}
                            className="w-full rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-slate-50 focus:bg-white transition-colors"
                          />
                        </div>
                       </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isLoading || isProcessingImages || images.length === 0}
                    className={`w-full py-3.5 px-4 rounded-xl shadow-lg text-white font-bold text-lg flex items-center justify-center space-x-2 transition-all transform active:scale-95 ${
                      isLoading || isProcessingImages || images.length === 0
                        ? 'bg-slate-300 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        生成中...
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>立即生成</span>
                      </>
                    )}
                  </button>
                  
                  {error && (
                    <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-pulse">
                      {error}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Results */}
              <div className="lg:col-span-8">
                <div className="h-full">
                  {generationResult ? (
                    <div className="space-y-6 animate-fade-in-up">
                      
                      {/* Detection Banner - NEW FEATURE */}
                      <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                        generationResult.analysis.confidence === 'HIGH' 
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : generationResult.analysis.confidence === 'MEDIUM'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        <div className="text-2xl mt-0.5">
                           {generationResult.analysis.confidence === 'HIGH' ? '🎯' : 
                            generationResult.analysis.confidence === 'MEDIUM' ? '🤔' : '👀'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                             <h4 className="font-bold">
                               AI 偵測地點：{generationResult.analysis.detectedName}
                             </h4>
                             <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                                generationResult.analysis.confidence === 'HIGH' ? 'bg-green-100 border-green-300 text-green-700' :
                                generationResult.analysis.confidence === 'MEDIUM' ? 'bg-amber-100 border-amber-300 text-amber-700' :
                                'bg-slate-200 border-slate-300 text-slate-600'
                             }`}>
                               信心: {generationResult.analysis.confidence}
                             </span>
                          </div>
                          <p className="text-sm mt-1 opacity-90">
                             {generationResult.analysis.evidence}
                          </p>
                          {generationResult.analysis.confidence !== 'HIGH' && (
                             <p className="text-xs mt-2 opacity-75">
                               💡 建議：若地點不準確，請在左側「旅遊細節」手動填入正確名稱後重新生成。
                             </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center space-x-3">
                           <h3 className="text-xl font-bold text-slate-800">生成結果</h3>
                           <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                             {generationResult.posts.length} 個版本
                           </span>
                         </div>
                         
                         <button
                           onClick={handleSaveResult}
                           disabled={isSaved}
                           className={`flex items-center space-x-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                             isSaved 
                               ? 'bg-green-50 border-green-200 text-green-700' 
                               : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                           }`}
                         >
                            {isSaved ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>已儲存</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                <span>儲存</span>
                              </>
                            )}
                         </button>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-6">
                        {generationResult.posts.map((post, idx) => (
                          <div key={idx} className="h-full">
                            <PlatformCard post={post} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 min-h-[500px] text-slate-400">
                      <div className="text-6xl mb-4 opacity-50">📝</div>
                      <p className="text-lg font-medium">生成的文案將會顯示在這裡</p>
                      <p className="text-sm mt-2">請先上傳照片並填寫旅遊資訊，最後點擊生成</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </main>

      {/* Footer with Version Info */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center text-sm text-slate-500">
           <p className="flex items-center space-x-2">
             <span>TravelFlow AI</span>
             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
             <button 
               onClick={() => setIsChangelogOpen(true)}
               className="hover:text-indigo-600 transition-colors underline decoration-slate-300 underline-offset-2 hover:decoration-indigo-300"
             >
               {APP_VERSION}
             </button>
           </p>
        </div>
      </footer>

      <EmojiEditorModal 
        isOpen={isEmojiModalOpen}
        onClose={() => setIsEmojiModalOpen(false)}
        currentEmojis={commonEmojis}
        onSave={handleSaveEmojis}
      />

      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
    </div>
  );
};

export default App;