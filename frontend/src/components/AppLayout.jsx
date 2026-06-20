import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import AIAssistant from '../components/AIAssistant';

export default function AppLayout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setCollapsed(c => !c)} onMobileClose={() => setMobileOpen(false)} />
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Header collapsed={collapsed} onMenuClick={() => setMobileOpen(true)} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}
