import React from 'react';
import { useLocation } from 'react-router-dom';

export default function Topbar() {
  const location = useLocation();
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Kiểm Tra Tuân Thủ Planogram';
      case '/history': return 'Lịch Sử Phân Tích';
      case '/planogram': return 'Tạo Planogram';
      case '/contracts': return 'Hợp Đồng Nhãn Hàng';
      case '/shelves': return 'Quản Lý Kệ Hàng';
      default: return 'POG Manager';
    }
  };

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span className="badge">1</span>
        <span>{getPageTitle()}</span>
      </div>
      <div className="user-nav">
        <div className="user-role">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Quản Lý Kệ Hàng | POG Manager
        </div>
      </div>
    </header>
  );
}
