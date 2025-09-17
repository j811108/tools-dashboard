import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // 工具
  const tools = [
    {
      id: 'excel-merge-tool',
      name: 'Excel merge tool',
      description: 'Excel檔案合併工具',
      path: '/excel-merge-tool',
      available: true
    },
    {
      id: 'daily-shipping-combine',
      name: 'Daily Shipping Combine',
      description: '每日出貨合併工具',
      path: '/daily-shipping-combine',
      available: true
    },
    {
      id: 'shipping-counter',
      name: 'Shipping Counter',
      description: '出貨計數工具',
      path: '/shipping-counter',
      available: false
    },
    {
      id: 'tester',
      name: 'Tester',
      description: 'TEST',
      path: '/tester',
      available: true
    }
  ];

  // 搜尋過濾邏輯
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    
    const query = searchQuery.toLowerCase();
    return tools.filter(tool => 
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleToolClick = (tool) => {
    if (tool.available) {
      navigate(tool.path);
    } else {
      alert(`${tool.name} 功能開發中...`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 標題 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Tools Dashboard
          </h1>
          <p className="text-gray-600">
            工具平台
          </p>
        </div>

        {/* 搜尋欄 */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="搜尋..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md mx-auto block px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* 工具方塊網格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className={`bg-white border border-gray-200 rounded-lg p-6 cursor-pointer transition-all duration-200 text-center relative
                ${tool.available 
                  ? 'hover:bg-gray-50 hover:border-gray-300 hover:shadow-md' 
                  : 'opacity-75 hover:opacity-90'
                }`}
            >
              {!tool.available && (
                <div className="absolute top-2 right-2">
                  <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full"></span>
                </div>
              )}
              {tool.available && (
                <div className="absolute top-2 right-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                </div>
              )}
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {tool.name}
              </h3>
              <p className="text-sm text-gray-600">
                {tool.description}
              </p>
              {!tool.available && (
                <p className="text-xs text-yellow-600 mt-2">開發中</p>
              )}
              {tool.available && (
                <p className="text-xs text-green-600 mt-2">可用</p>
              )}
            </div>
          ))}
        </div>

        {/* 沒有找到工具的提示 */}
        {filteredTools.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <p className="text-gray-500">找不到相關工具</p>
          </div>
        )}

        {/* 底部資訊 */}
        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>共 {filteredTools.length} 個工具</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;