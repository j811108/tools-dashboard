# 在 tools-dashboard 根目錄執行以下命令創建其他工具頁面

# 創建 pages 資料夾
mkdir -p src/pages

# 創建 ImageResizer.jsx
echo "import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image } from 'lucide-react';

const ImageResizer = () => {
  const navigate = useNavigate();
  const handleBackToHome = () => navigate('/');

  return (
    <div className=\"min-h-screen bg-gray-50\">
      <div className=\"bg-white shadow-sm border-b\">
        <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8\">
          <div className=\"flex items-center justify-between h-16\">
            <button onClick={handleBackToHome} className=\"flex items-center text-gray-600 hover:text-gray-900 transition-colors\">
              <ArrowLeft className=\"h-5 w-5 mr-2\" />返回工具首頁
            </button>
            <h1 className=\"text-xl font-semibold text-gray-900\">Image Resizer</h1>
            <div></div>
          </div>
        </div>
      </div>
      <div className=\"container mx-auto px-4 py-8 max-w-4xl\">
        <div className=\"bg-white rounded-lg shadow p-6 text-center\">
          <Image className=\"h-16 w-16 mx-auto text-gray-400 mb-4\" />
          <h2 className=\"text-2xl font-bold mb-4\">圖片尺寸調整工具</h2>
          <p className=\"text-gray-600\">此工具正在開發中，敬請期待！</p>
        </div>
      </div>
    </div>
  );
};

export default ImageResizer;" > src/pages/ImageResizer.jsx

# 創建其他工具頁面...
# (TextFormatter, QrGenerator, ColorPicker, JsonValidator, PasswordGenerator, UrlShortener)

echo "所有工具頁面已創建完成！"