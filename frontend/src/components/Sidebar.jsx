import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, ShoppingCart, TruckIcon,
  Factory, ClipboardList, FileText, Users, ChevronLeft,
  ChevronRight, LogOut, Settings
} from 'lucide-react';

// Role-based nav items
const NAV_ITEMS = [
  {
    section: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','sales','purchase','manufacturing','inventory'] },
    ]
  },
  {
    section: 'Operations',
    items: [
      { path: '/products',      label: 'Products',       icon: Package,       roles: ['admin','inventory'] },
      { path: '/sales',         label: 'Sales Orders',   icon: ShoppingCart,  roles: ['admin','sales'] },
      { path: '/purchase',      label: 'Purchase Orders',icon: TruckIcon,     roles: ['admin','purchase'] },
      { path: '/manufacturing', label: 'Manufacturing',  icon: Factory,       roles: ['admin','manufacturing'] },
      { path: '/bom',           label: 'Bill of Materials', icon: ClipboardList, roles: ['admin','manufacturing'] },
    ]
  },
  {
    section: 'Admin',
    items: [
      { path: '/audit',  label: 'Audit Logs',      icon: FileText, roles: ['admin'] },
      { path: '/users',  label: 'User Management', icon: Users,    roles: ['admin'] },
    ]
  }
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const filteredNav = NAV_ITEMS.map(section => ({
    ...section,
    items: section.items.filter(item => item.roles.includes(user?.role))
  })).filter(section => section.items.length > 0);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🪑</div>
        <div className="sidebar-logo-text">
          <h2>ShivERP</h2>
          <span>Furniture Works</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {filteredNav.map(section => (
          <div key={section.section} className="nav-section">
            <div className="nav-section-label">{section.section}</div>
            {section.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : ''}
              >
                <item.icon size={18} className="nav-item-icon" />
                <span className="nav-item-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User Info */}
      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{user?.name?.split(' ')[0]}</div>
          <div className="user-role">{user?.role}</div>
        </div>
      </div>

      {/* Toggle + Logout */}
      <div className="sidebar-toggle">
        <button className="toggle-btn" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
          <span className="nav-item-label">Logout</span>
        </button>
        <button className="toggle-btn" style={{ marginTop: 6 }} onClick={onToggle} title="Toggle sidebar">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <span className="nav-item-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
