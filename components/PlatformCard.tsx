import React, { useState } from 'react';
import { GeneratedPost, Platform } from '../types';

interface PlatformCardProps {
  post: GeneratedPost;
}

const PlatformCard: React.FC<PlatformCardProps> = ({ post }) => {
  const [copied, setCopied] = useState(false);

  // Simple Chinese/English word count approximation
  const wordCount = post.content.length;

  const getIcon = (platform: Platform) => {
    switch (platform) {
      case Platform.INSTAGRAM:
        return (
          <svg className="w-6 h-6 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        );
      case Platform.FACEBOOK:
        return (
          <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
          </svg>
        );
      case Platform.THREADS:
        return (
          <svg className="w-6 h-6 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.186 19.314c-1.219.866-2.583 1.288-4.008 1.288-4.09 0-7.397-3.376-7.397-7.989 0-4.786 3.518-8.625 8.169-8.625 4.908 0 7.828 3.417 7.828 7.828 0 3.792-.731 5.394-2.169 5.394-.65 0-1.112-.375-1.112-1.113V6.262h-2.189v9.75c0 1.719 1.341 2.875 3.125 2.875 3.181 0 4.625-2.613 4.625-6.988 0-5.637-3.875-9.988-10.108-9.988C3.587 1.912 0 5.862 0 11.238c0 5.612 3.687 9.85 9.012 9.85 2.45 0 4.544-.8 5.769-2.112l-2.595-1.662ZM10.5 13.925c-.237.045-.5.075-.787.075-1.956 0-3.413-1.413-3.413-3.375 0-1.938 1.4-3.375 3.375-3.375.288 0 .55.038.788.087v6.588Z" />
          </svg>
        );
      case Platform.VOCUS:
        return (
          <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        );
      case Platform.PIXNET:
        return (
          <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H8v-2h2V9h2v2h2v2h-2v4z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const getFullText = () => {
    return `${post.title ? post.title + '\n\n' : ''}${post.content}\n\n${post.hashtags.map(t => `#${t}`).join(' ')}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getFullText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExport = () => {
    const fullText = getFullText();
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Format filename like: Instagram_TravelFlow_2024-05-20.txt
    link.download = `${post.platform}_TravelFlow_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-full transform transition hover:-translate-y-1 hover:shadow-xl duration-300">
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getIcon(post.platform)}
          <h3 className="font-bold text-lg text-slate-800">{post.platform}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="p-2 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
            title="下載純文字檔 (.txt)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={copyToClipboard}
            className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              copied ? 'bg-green-100 text-green-700 focus:ring-green-500' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 focus:ring-indigo-500'
            }`}
          >
            {copied ? '已複製！' : '複製全文'}
          </button>
        </div>
      </div>
      
      <div className="p-6 flex-grow overflow-y-auto">
        {post.title && (
          <h4 className="text-xl font-bold mb-4 text-slate-900 leading-tight">
            {post.title}
          </h4>
        )}
        <div className="prose prose-slate prose-sm max-w-none text-slate-700 whitespace-pre-line">
          {post.content}
        </div>
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
         <span>約 {wordCount} 字</span>
      </div>

      <div className="p-5 pt-2 bg-slate-50 border-t-0 border-slate-100">
        <div className="flex flex-wrap gap-2">
          {post.hashtags.map((tag, idx) => (
            <span key={idx} className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformCard;