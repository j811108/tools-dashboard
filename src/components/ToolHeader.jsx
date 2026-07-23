import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HelpButton } from './HelpModal';

/**
 * 各工具頁共用的頁首：左邊返回、中間標題、右邊幫助。
 * 版面與首頁 header（index.css 的 .hdr）對齊：同樣 sticky、同樣 1100px 寬、同一組色票。
 *
 * @param {string} title 頁面標題
 * @param {function} onHelp 點「幫助」的 callback；不給就不顯示幫助按鈕
 */
export default function ToolHeader({ title, onHelp }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-5 sm:px-8">
        <button
          onClick={() => navigate('/')}
          className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">返回工具首頁</span>
        </button>

        <h1 className="truncate text-base font-semibold tracking-tight text-stone-800 sm:text-lg">
          {title}
        </h1>

        <div className="flex shrink-0 justify-end">
          {onHelp ? <HelpButton onClick={onHelp} /> : <span className="w-24" />}
        </div>
      </div>
    </header>
  );
}
