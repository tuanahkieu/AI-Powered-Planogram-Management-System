import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Grip, FileText, Layers, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function Sidebar() {
  const navItems = [
    { path: '/', label: 'Kiểm Tra', icon: LayoutDashboard, badge: 'AI' },
    { path: '/history', label: 'Lịch Sử', icon: History },
    { path: '/planogram', label: 'Tạo Planogram', icon: Grip },
    { path: '/contracts', label: 'Hợp Đồng', icon: FileText },
    { path: '/shelves', label: 'Kệ Hàng', icon: Layers },
  ];

  return (
    <motion.aside 
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="fixed top-0 left-0 h-screen w-64 bg-slate-50/95 dark:bg-[#0B1120]/95 backdrop-blur-xl border-r border-border/50 flex flex-col py-6 z-[100] shadow-2xl overflow-hidden shrink-0"
    >
      <div className="flex items-center mb-10 pt-2 px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-ai-bg text-white shadow-lg">
          <Layers size={22} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground ml-3 whitespace-nowrap">
          POG<span className="text-[#06b6d4]">Manager</span>
        </h2>
      </div>

      <nav className="flex-1 px-3 overflow-x-hidden overflow-y-auto no-scrollbar min-h-0">
        <div className="mb-6">
          <h3 className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest px-3 mb-3 whitespace-nowrap">QUẢN LÝ</h3>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path}>
                  {({ isActive }) => (
                    <motion.div
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "flex items-center px-3 py-2 rounded-lg transition-colors cursor-pointer text-sm font-medium",
                        isActive 
                          ? "bg-surface text-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                          : "text-muted-foreground hover:text-foreground hover:bg-surface/80"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0 transition-colors mr-3", isActive ? "text-[#06b6d4]" : "text-muted-foreground group-hover:text-cyan-500/70")} />
                      <span className="flex-1 whitespace-nowrap">{item.label}</span>
                      {item.badge && (
                        <Badge variant={isActive ? "default" : "secondary"} className={cn("h-5 px-1.5 text-[10px]", isActive ? "bg-[#06b6d4] text-white" : "")}>
                          {item.badge}
                        </Badge>
                      )}
                      
                      {isActive && (
                        <motion.div
                          layoutId="active-indicator"
                          className="absolute left-0 w-1 h-5 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </motion.div>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="mt-auto pb-4 shrink-0 pt-2 bg-surface/30 backdrop-blur-md px-4 relative z-10">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface cursor-pointer border ultra-thin-border">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-ai-bg text-white font-bold text-sm shadow-md">
            <Store size={18} />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-semibold truncate">Admin Store</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Hệ thống</span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
