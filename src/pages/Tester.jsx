import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const Tester = () => {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBackToHome}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              返回工具首頁
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              PDF Converter
            </h1>
            <div></div>
          </div>
        </div>
      </div>

      {/* 主要內容區域 */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold mb-4">工具</h2>
            <p className="text-gray-600 mb-8">
              此工具正在開發中，敬請期待！
            </p>
            
            {/* 預期功能描述 */}
            <div className="text-left max-w-md mx-auto">
              <h3 className="font-semibold text-gray-800 mb-3">預期功能：</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• PDF 轉 Word 文檔</li>
                <li>• PDF 轉 Excel 表格</li>
                <li>• PDF 轉圖片</li>
                <li>• Word/Excel 轉 PDF</li>
                <li>• 批量轉換支援</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tester;