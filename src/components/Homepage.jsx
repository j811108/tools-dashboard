import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const tools = [
  {
    id: 'excel-merge-tool',
    name: '庫存表',
    description: 'Excel Merge Tool',
    path: '/excel-merge-tool',
    available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
  },
  {
    id: 'daily-shipping-combine',
    name: '每日出貨合併工具',
    description: 'Daily Shipping Combine',
    path: '/daily-shipping-combine',
    available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    id: 'count-shipping-subtotal',
    name: '出貨明細計算業績',
    description: 'Count Shipping Subtotal',
    path: '/count-shipping-subtotal',
    available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: 'month-shipping-count',
    name: '每月出貨統計',
    description: 'Month Shipping Count',
    path: '/month-shipping-count',
    available: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'tester',
    name: 'Tester',
    description: 'TEST',
    path: '/tester',
    available: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
  },
];

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const availableCount = filteredTools.filter(t => t.available).length;

  const handleToolClick = (tool) => {
    if (tool.available) navigate(tool.path);
  };

  return (
    <>
      <header className="hdr">
        <div className="hdr-inner">
          <div className="hdr-logo">
            <div className="hdr-logo-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="#0d0d10"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="#0d0d10"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="#0d0d10"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="#0d0d10" opacity="0.4"/>
              </svg>
            </div>
            <span className="hdr-logo-text">tools<span>.</span>dashboard</span>
          </div>
          <span className="hdr-meta">工具平台</span>
        </div>
      </header>

      <div className="page">
        <main className="page-main">
          <div className="hero">
            <div className="hero-label">工具平台</div>
            <h1 className="hero-title">Tools Dashboard</h1>
            <p className="hero-sub">選擇工具以開始操作</p>
          </div>

          <div className="search-row">
            <div className="search-box">
              <span className="search-icon"><SearchIcon /></span>
              <input
                className="search-input"
                type="text"
                placeholder="搜尋工具..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="tool-count">
              共 <strong>{availableCount}</strong> 個可用工具
            </span>
          </div>

          <div className="tool-grid">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                className={`tool-card ${tool.available ? 'available' : 'unavailable'}`}
                onClick={() => handleToolClick(tool)}
              >
                <div className="card-accent" />
                <div className="card-header">
                  <div className="card-icon">{tool.icon}</div>
                  {tool.available
                    ? <span className="card-status status-available"><span className="status-dot" />可用</span>
                    : <span className="card-status status-dev"><span className="status-dot" />開發中</span>
                  }
                </div>
                <div>
                  <p className="card-name">{tool.name}</p>
                  <p className="card-desc">{tool.description}</p>
                </div>
                <div className="card-footer">
                  <span className="card-id">{tool.id}</span>
                  {tool.available && <span className="card-arrow"><ArrowIcon /></span>}
                </div>
              </div>
            ))}
          </div>

          {filteredTools.length === 0 && searchQuery && (
            <div className="empty-state">找不到相關工具</div>
          )}
        </main>

        <footer className="page-footer">
          <span className="page-footer-text">tools.dashboard · 工具平台</span>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
