import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/Homepage';
import ExcelMergeTool from './pages/ExcelMergeTool';
import Tester from './pages/Tester';
import DailyShippingCombine from './pages/DailyShippingCombine';
import CountShippingSubTotal from './pages/CountShippingSubTotal';
import MonthShippingCount from './pages/MonthShippingCount';

function App() {
  return (
    <Router basename="/tools-dashboard">
      <div className="App">
        <Routes>
          {/* 首頁 */}
          <Route path="/" element={<HomePage />} />
          
          {/* 暫時註解掉其他路由，先讓首頁能正常顯示 */}
          <Route path="/excel-merge-tool" element={<ExcelMergeTool />} />
          <Route path="/tester" element={<Tester />} />
          <Route path="/daily-shipping-combine" element={<DailyShippingCombine />} />
          <Route path="/count-shipping-subtotal" element={<CountShippingSubTotal />} />
          <Route path="/month-shipping-count" element={<MonthShippingCount />} />

          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
