import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CheckPage from './features/check/CheckPage';
import HistoryPage from './features/history/HistoryPage';
import PlanogramPage from './features/planogram/PlanogramPage';
import ContractsPage from './features/contracts/ContractsPage';
import ShelvesPage from './features/shelves/ShelvesPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="dark flex min-h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-y-auto overflow-x-hidden p-6 lg:p-8 bg-background transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<CheckPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/planogram" element={<PlanogramPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/shelves" element={<ShelvesPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
