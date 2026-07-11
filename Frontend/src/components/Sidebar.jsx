import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Grip, FileText, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function Sidebar() {
  const navItems = [
    { path: '/', label: 'Kiểm Tra', icon: LayoutDashboard, badge: 'AI' },
    { path: '/history', label: 'Lịch Sử Phân Tích', icon: History },
    { path: '/planogram', label: 'Tạo Planogram', icon: Grip },
    { path: '/contracts', label: 'Hợp Đồng Nhãn Hàng', icon: FileText },
    { path: '/shelves', label: 'Quản Lý Kệ Hàng', icon: Layers },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-primary/20 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent backdrop-blur-xl text-card-foreground shadow-lg flex flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 px-6 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers size={20} />
        </div>
        <span className="font-semibold tracking-tight text-lg">POG Manager</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        <div className="px-2 pb-2 text-xs font-semibold tracking-wider text-muted-foreground">
          QUẢN LÝ
        </div>
        
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <Badge variant={isActive ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                    {item.badge}
                  </Badge>
                )}
                
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 h-1/2 w-1 -translate-y-1/2 rounded-r-md bg-primary"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t p-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted cursor-pointer">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
            AI
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Admin Store</span>
            <span className="text-xs text-muted-foreground">Quản lý cửa hàng</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
