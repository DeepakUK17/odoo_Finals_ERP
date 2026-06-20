import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import ProfileModal from './ProfileModal';
import { Search, Menu } from 'lucide-react';

const PAGE_TITLES = {
  '/dashboard': ['Dashboard', 'Business overview'],
  '/products': ['Products', 'Manage your product catalog'],
  '/sales': ['Sales Orders', 'Process customer orders'],
  '/purchase': ['Purchase Orders', 'Manage supplier orders'],
  '/manufacturing': ['Manufacturing', 'Production orders & work orders'],
  '/bom': ['Bill of Materials', 'Product recipes & components'],
  '/audit': ['Audit Logs', 'System-wide activity trail'],
  '/users': ['User Management', 'Manage team access'],
};

export default function Header({ collapsed, onMenuClick }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  
  const [title, subtitle] = PAGE_TITLES[pathname] || ['ERP', 'Shiv Furniture Works'];
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className={`header ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="header-left">
        <button className="mobile-menu-btn icon-btn" onClick={onMenuClick} style={{ marginRight: 12 }}>
          <Menu size={20} />
        </button>
        <div className="breadcrumb">
          <span className="breadcrumb-item">Shiv ERP</span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-item current">{title}</span>
        </div>
      </div>

      <div className="header-right">
        <div className="header-search">
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Quick search..." id="header-search-input" />
        </div>
        <NotificationBell />
        <div className="user-avatar" style={{ width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden' }} title={user?.name} onClick={() => setShowProfile(true)}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
      </div>
      
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </header>
  );
}
