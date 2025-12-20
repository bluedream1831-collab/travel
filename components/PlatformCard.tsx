
import React, { useState, useEffect } from 'react';
import { GeneratedPost, Platform } from '../types';

interface PlatformCardProps {
  post: GeneratedPost;
}

const PlatformCard: React.FC<PlatformCardProps> = ({ post }) => {
  const [copied, setCopied] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  
  const wordCount = post.content.length;
  const isLongForm = post.platform === Platform.VOCUS || post.platform === Platform.PIXNET;

  // 打字機動態效果
  useEffect(() => {
    let index = 0;
    const speed = isLongForm ? 5 : 15; // 長文打字速度加快
    const timer = setInterval(() => {
      if (index < post.content.length) {
        setDisplayText(post.content.slice(0, index + 1));
        index++;
      } else {
        setIsFinished(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [post.content, isLongForm]);

  const getPlatformStyle = (platform: Platform) => {
    switch (platform) {
      case Platform.INSTAGRAM: return { iconColor: 'text-pink-500', bgColor: 'bg-pink-50', borderColor: 'border-pink-100' };
      case Platform.FACEBOOK: return { iconColor: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-100' };
      case Platform.THREADS: return { iconColor: 'text-slate-900', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' };
      case Platform.VOCUS: return { iconColor: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-100' };
      case Platform.PIXNET: return { iconColor: 'text-sky-600', bgColor: 'bg-sky-50', borderColor: 'border-sky-100' };
      default: return { iconColor: 'text-slate-500', bgColor: 'bg-slate-50', borderColor: 'border-slate-100' };
    }
  };

  const style = getPlatformStyle(post.platform);

  const copyToClipboard = () => {
    const fullText = `${post.title ? post.title + '\n\n' : ''}${post.content}\n\n${post.hashtags.map(t => `#${t}`).join(' ')}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const skipAnimation = () => {
    setDisplayText(post.content);
    setIsFinished(true);
  };

  return (
    <div className={`bg-white rounded-2xl border ${style.borderColor} shadow-sm overflow-hidden flex flex-col h-full transition-all hover:shadow-md ${isLongForm ? 'ring-1 ring-orange-100' : ''}`}>
      <div className={`p-4 ${style.bgColor} flex items-center justify-between border-b ${style.borderColor}`}>
        <div className="flex items-center space-x-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-white border ${style.borderColor} ${style.iconColor}`}>
            {post.platform === Platform.VOCUS ? '方格子部落格' : post.platform}
          </span>
          {!isFinished && <span className="animate-pulse text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Generating...</span>}
        </div>
        <div className="flex items-center space-x-2">
          {!isFinished && (
            <button onClick={skipAnimation} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">跳過動畫</button>
          )}
          <button
            onClick={copyToClipboard}
            className={`text-[10px] px-3 py-1.5 rounded-full font-bold transition-all shadow-sm flex items-center space-x-1 ${
              copied ? 'bg-green-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300'
            }`}
          >
            {copied ? '✓ 已複製' : '📋 複製全文'}
          </button>
        </div>
      </div>
      
      <div className={`p-6 flex-grow overflow-y-auto ${isLongForm ? 'max-h-[500px]' : 'max-h-[350px]'} custom-scrollbar bg-white relative`}>
        {post.title && (
          <h4 className={`font-black mb-4 text-slate-900 leading-tight ${isLongForm ? 'text-xl border-l-4 border-orange-500 pl-3' : 'text-base'}`}>
            {post.title}
          </h4>
        )}
        <div className={`text-slate-700 whitespace-pre-line leading-relaxed tracking-wide ${isLongForm ? 'text-base' : 'text-sm'}`}>
          {displayText}
          {!isFinished && <span className="inline-block w-2 h-5 bg-indigo-500 ml-1 animate-pulse align-middle"></span>}
        </div>
      </div>

      <div className="p-4 bg-slate-50/50 border-t border-slate-50">
        <div className={`flex flex-wrap gap-2 transition-opacity duration-500 ${isFinished ? 'opacity-100' : 'opacity-30'}`}>
          {post.hashtags.map((tag, idx) => (
            <span key={idx} className="text-[11px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">#{tag}</span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold">
          <span>{isFinished ? wordCount : displayText.length} / {wordCount} 字</span>
          {isLongForm && isFinished && <span className="text-orange-500">✨ 深度創作完成</span>}
        </div>
      </div>
    </div>
  );
};

export default PlatformCard;
