import React, { useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';

// 將 **粗體** 與 `程式碼` 轉成 React 節點
function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="px-1 py-0.5 mx-0.5 rounded bg-gray-100 text-blue-700 text-[0.85em] font-mono break-all">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

const isTableRow = (line) => line.trim().startsWith('|') && line.trim().endsWith('|');
const isDividerRow = (line) => /^\|[\s:|-]+\|$/.test(line.trim());
const splitRow = (line) => line.trim().slice(1, -1).split('|').map((c) => c.trim());

// 極簡 Markdown 渲染：## / ### 標題、- 清單、1. 有序清單、> 引言、表格、段落
function renderMarkdown(md) {
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const k = i; // 固定住當下索引，供 key 使用（避免閉包引用可變的 i）

    if (!line.trim()) { i += 1; continue; }

    // 表格
    if (isTableRow(line) && i + 1 < lines.length && isDividerRow(lines[i + 1])) {
      const headers = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`t-${k}`} className="overflow-x-auto mb-4">
          <table className="min-w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    {renderInline(h, `th-${k}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri % 2 ? 'bg-gray-50/50' : ''}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-700 border-b border-gray-100 align-top">
                      {renderInline(c, `td-${k}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 標題
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${k}`} className="text-base font-semibold text-gray-800 mt-5 mb-2">
          {renderInline(line.slice(4), `h3i-${k}`)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${k}`} className="text-lg font-bold text-gray-900 mt-6 mb-3 pb-1 border-b border-gray-200 first:mt-0">
          {renderInline(line.slice(3), `h2i-${k}`)}
        </h2>
      );
      i += 1;
      continue;
    }

    // 引言
    if (line.startsWith('> ')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quote.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote key={`q-${k}`} className="border-l-4 border-blue-400 bg-blue-50 text-gray-700 px-4 py-2 mb-4 rounded-r text-sm">
          {renderInline(quote.join(' '), `qi-${k}`)}
        </blockquote>
      );
      continue;
    }

    // 有序清單
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${k}`} className="list-decimal pl-6 mb-4 space-y-1 text-sm text-gray-700">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `oli-${k}-${ii}`)}</li>)}
        </ol>
      );
      continue;
    }

    // 無序清單
    if (/^-\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s/.test(lines[i])) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${k}`} className="list-disc pl-6 mb-4 space-y-1 text-sm text-gray-700">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `uli-${k}-${ii}`)}</li>)}
        </ul>
      );
      continue;
    }

    // 一般段落
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|-\s|>\s|\d+\.\s)/.test(lines[i]) && !isTableRow(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${k}`} className="text-sm text-gray-700 leading-relaxed mb-3">
        {renderInline(para.join(' '), `pi-${k}`)}
      </p>
    );
  }

  return blocks;
}

/**
 * 說明浮動視窗
 * @param {boolean} open 是否開啟
 * @param {function} onClose 關閉 callback
 * @param {string} title 標題
 * @param {string} content Markdown 內容（見 src/data/helpDocs.js）
 */
export default function HelpModal({ open, onClose, title, content }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[85vh] rounded-lg shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="關閉說明"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          {renderMarkdown(content)}
        </div>
        <div className="px-6 py-3 border-t border-gray-200 text-right shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

// 給各工具頁 Header 右側使用的「幫助」按鈕
export function HelpButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-stone-600 transition-colors hover:bg-clay-50 hover:text-clay-700"
    >
      <HelpCircle className="h-4 w-4" />
      幫助
    </button>
  );
}
