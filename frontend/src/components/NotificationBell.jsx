import { useState, useEffect, useRef } from 'react';
import { Bell, Search, X, Check } from 'lucide-react';
import api from '../api/client';
import { useSocket } from '../context/SocketContext';

const TYPE_ICON = {
  low_stock: '⚠️',
  purchase_order_pending: '🛒',
  manufacturing_completed: '🏭',
  sales_order_confirmed: '✅',
  delivery_done: '📦',
  warning: '⚠️',
  info: 'ℹ️',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  };

  const socket = useSocket();

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewNotif = (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Play a subtle notification sound (optional, assuming browser allows)
      try {
        new Audio('/notification.mp3').play().catch(() => {});
      } catch (e) {}
    };

    socket.on('new_notification', handleNewNotif);
    return () => socket.off('new_notification', handleNewNotif);
  }, [socket]);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    setOpen(false);
  };

  return (
    <div className="notif-container" ref={dropdownRef}>
      <button className="icon-btn" onClick={() => setOpen(o => !o)} id="notif-bell-btn">
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h3>🔔 Notifications {unreadCount > 0 && `(${unreadCount})`}</h3>
            {unreadCount > 0 && (
              <button className="notif-read-all" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                <p>No notifications</p>
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                onClick={() => !n.isRead && markRead(n.id)}
              >
                <span className={`notif-dot ${n.type}`} />
                <div className="notif-content">
                  <div className="notif-title">{TYPE_ICON[n.type]} {n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
