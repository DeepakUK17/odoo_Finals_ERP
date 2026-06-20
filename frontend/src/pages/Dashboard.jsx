import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart, TruckIcon, Factory, Package,
  AlertTriangle, TrendingUp, Activity, Clock
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, LineElement, PointElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const ROLE_KPIS = {
  admin: [
    { key: 'totalSales', label: 'Total Sales Orders', icon: ShoppingCart, color: 'hsl(217,91%,60%)', bg: 'hsla(217,91%,60%,0.12)' },
    { key: 'pendingDeliveries', label: 'Pending Deliveries', icon: TruckIcon, color: 'hsl(38,92%,50%)', bg: 'hsla(38,92%,50%,0.12)' },
    { key: 'totalMO', label: 'Manufacturing Orders', icon: Factory, color: 'hsl(199,89%,55%)', bg: 'hsla(199,89%,55%,0.12)' },
    { key: 'lowStockCount', label: 'Low Stock Alerts', icon: AlertTriangle, color: 'hsl(0,84%,60%)', bg: 'hsla(0,84%,60%,0.12)' },
    { key: 'totalPurchase', label: 'Purchase Orders', icon: Package, color: 'hsl(270,91%,65%)', bg: 'hsla(270,91%,65%,0.12)' },
    { key: 'totalProducts', label: 'Products', icon: Package, color: 'hsl(142,69%,45%)', bg: 'hsla(142,69%,45%,0.12)' },
  ],
  sales: [
    { key: 'totalSales', label: 'Total Sales Orders', icon: ShoppingCart, color: 'hsl(217,91%,60%)', bg: 'hsla(217,91%,60%,0.12)' },
    { key: 'pendingDeliveries', label: 'Pending Deliveries', icon: TruckIcon, color: 'hsl(38,92%,50%)', bg: 'hsla(38,92%,50%,0.12)' },
    { key: 'weeklyRevenue', label: 'Revenue This Week (₹)', icon: TrendingUp, color: 'hsl(142,69%,45%)', bg: 'hsla(142,69%,45%,0.12)' },
  ],
  purchase: [
    { key: 'totalPurchase', label: 'Purchase Orders', icon: Package, color: 'hsl(270,91%,65%)', bg: 'hsla(270,91%,65%,0.12)' },
    { key: 'partialReceipts', label: 'Partially Received', icon: TruckIcon, color: 'hsl(38,92%,50%)', bg: 'hsla(38,92%,50%,0.12)' },
  ],
  manufacturing: [
    { key: 'totalMO', label: 'Manufacturing Orders', icon: Factory, color: 'hsl(199,89%,55%)', bg: 'hsla(199,89%,55%,0.12)' },
    { key: 'activeMO', label: 'Active (In Progress)', icon: Activity, color: 'hsl(217,91%,60%)', bg: 'hsla(217,91%,60%,0.12)' },
  ],
  inventory: [
    { key: 'totalProducts', label: 'Total Products', icon: Package, color: 'hsl(217,91%,60%)', bg: 'hsla(217,91%,60%,0.12)' },
    { key: 'lowStockCount', label: 'Low Stock Alerts', icon: AlertTriangle, color: 'hsl(0,84%,60%)', bg: 'hsla(0,84%,60%,0.12)' },
  ],
};

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({});
  const [lowStock, setLowStock] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, ls, ra, cd] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/low-stock'),
          api.get('/dashboard/recent-activity'),
          api.get('/dashboard/sales-chart'),
        ]);
        setSummary(s.data.data || {});
        setLowStock(ls.data.data || []);
        setRecentActivity(ra.data.data || []);

        const days = cd.data.data || [];
        setChartData({
          labels: days.map(d => new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })),
          datasets: [{
            label: 'Sales Orders',
            data: days.map(d => d.count),
            backgroundColor: 'rgba(59,130,246,0.7)',
            borderColor: 'rgba(59,130,246,1)',
            borderWidth: 2,
            borderRadius: 6,
          }]
        });
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    load();
  }, []);

  const kpis = ROLE_KPIS[user?.role] || ROLE_KPIS.admin;

  const getActionIcon = (action) => {
    if (action.includes('CONFIRM')) return '✅';
    if (action.includes('CREAT')) return '➕';
    if (action.includes('DELIVER')) return '📦';
    if (action.includes('CANCEL')) return '❌';
    if (action.includes('COMPLET')) return '🏁';
    if (action.includes('RECEIV')) return '📥';
    return '📝';
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /><span>Loading dashboard...</span></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} •
            <span className={`badge badge-${user?.role}`} style={{ marginLeft: 8 }}>{user?.role}</span>
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map(kpi => (
          <div
            key={kpi.key}
            className="kpi-card"
            style={{ '--kpi-color': kpi.color, '--kpi-bg': kpi.bg }}
          >
            <div className="kpi-header">
              <div className="kpi-icon">
                <kpi.icon size={20} />
              </div>
              {kpi.key === 'lowStockCount' && summary[kpi.key] > 0 && (
                <span className="badge badge-danger">!</span>
              )}
            </div>
            <div className="kpi-value">
              {kpi.key === 'weeklyRevenue'
                ? `₹${((summary[kpi.key] || 0) / 1000).toFixed(1)}K`
                : summary[kpi.key] ?? '—'}
            </div>
            <div className="kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="content-grid">
        {/* Sales Chart */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontFamily: 'Outfit', fontSize: 16, fontWeight: 600 }}>
            📈 Sales Orders — Last 7 Days
          </h3>
          {chartData ? (
            <Bar data={chartData} options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'var(--bg-card)', titleColor: 'var(--text-primary)', bodyColor: 'var(--text-secondary)', borderColor: 'var(--border)', borderWidth: 1 }
              },
              scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--text-muted)', font: { size: 11 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--text-muted)', precision: 0 }, beginAtZero: true }
              }
            }} />
          ) : <div className="loading-overlay" style={{ minHeight: 180 }}><div className="spinner" /></div>}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Low Stock */}
          <div className="card">
            <h3 style={{ marginBottom: 12, fontFamily: 'Outfit', fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>
              ⚠️ Low Stock Alerts ({lowStock.length})
            </h3>
            {lowStock.length === 0 ? (
              <p style={{ color: 'var(--success)', fontSize: 13 }}>✅ All products are well-stocked</p>
            ) : lowStock.slice(0, 6).map(p => {
              const pct = Math.min(100, (p.onHandQty / Math.max(p.minStockLevel, 1)) * 100);
              const cls = p.onHandQty === 0 ? 'danger' : pct < 50 ? 'warn' : 'ok';
              return (
                <div key={p.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                    <span className={`badge badge-${p.onHandQty === 0 ? 'cancelled' : 'partially_delivered'}`} style={{ fontSize: 11 }}>
                      {p.onHandQty} / {p.minStockLevel} {p.unit}
                    </span>
                  </div>
                  <div className="stock-bar">
                    <div className="stock-bar-track">
                      <div className={`stock-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 16, fontFamily: 'Outfit', fontSize: 16, fontWeight: 600 }}>
          🕒 Recent Activity
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentActivity.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recent activity</p>
          ) : recentActivity.slice(0, 8).map(log => (
            <div key={log.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 8, transition: 'background 0.2s' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{getActionIcon(log.action)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  <span className={`badge badge-${log.model.toLowerCase()}`} style={{ marginRight: 6, fontSize: 10 }}>{log.model}</span>
                  {log.description}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {log.user?.name || 'System'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <span className={`badge badge-draft`} style={{ fontSize: 11, flexShrink: 0 }}>{log.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
