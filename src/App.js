import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/Homepage';
import ExcelMergeTool from './pages/ExcelMergeTool';
import Tester from './pages/Tester';
import DailyShippingCombine from './pages/DailyShippingCombine';
// import TextFormatter from './pages/TextFormatter';
// import QrGenerator from './pages/QrGenerator';
// import ColorPicker from './pages/ColorPicker';
// import JsonValidator from './pages/JsonValidator';
// import PasswordGenerator from './pages/PasswordGenerator';
// import UrlShortener from './pages/UrlShortener';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* 首頁 */}
          <Route path="/" element={<HomePage />} />
          
          {/* 暫時註解掉其他路由，先讓首頁能正常顯示 */}
          <Route path="/excel-merge-tool" element={<ExcelMergeTool />} />
          <Route path="/tester" element={<Tester />} />
          <Route path="/daily-shipping-combine" element={<DailyShippingCombine />} />
          {/* <Route path="/text-formatter" element={<TextFormatter />} /> */}
          {/* <Route path="/qr-generator" element={<QrGenerator />} /> */}
          {/* <Route path="/color-picker" element={<ColorPicker />} /> */}
          {/* <Route path="/json-validator" element={<JsonValidator />} /> */}
          {/* <Route path="/password-generator" element={<PasswordGenerator />} /> */}
          {/* <Route path="/url-shortener" element={<UrlShortener />} /> */}
          
          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
