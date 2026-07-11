import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CheckPage from './pages/CheckPage';
import HistoryPage from './pages/HistoryPage';
import PlanogramPage from './pages/PlanogramPage';
import ContractsPage from './pages/ContractsPage';
import ShelvesPage from './pages/ShelvesPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20 text-foreground">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
          <Routes>
            <Route path="/" element={<CheckPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/planogram" element={<PlanogramPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/shelves" element={<ShelvesPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
