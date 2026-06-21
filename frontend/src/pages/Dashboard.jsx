import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  ShoppingCart, TruckIcon, Factory, Package,
  AlertTriangle, TrendingUp, Activity, Clock, X
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar as RechartsBar, Legend as RechartsLegend, Cell
} from 'recharts';

const ROLE_KPIS = {
  admin: [
    { key: 'weeklyOrders', label: 'Sales Orders (This Week)', icon: ShoppingCart, color: 'hsl(217,91%,60%)', bg: 'hsla(217,91%,60%,0.12)' },
    { key: 'pendingDeliveries', label: 'Pending Deliveries', icon: TruckIcon, color: 'hsl(38,92%,50%)', bg: 'hsla(38,92%,50%,0.12)' },
    { key: 'totalMO', label: 'Manufacturing Orders', icon: Factory, color: 'hsl(199,89%,55%)', bg: 'hsla(199,89%,55%,0.12)' },
    { key: 'lowStockCount', label: 'Low Stock Alerts', icon: AlertTriangle, color: 'hsl(0,84%,60%)', bg: 'hsla(0,84%,60%,0.12)' },
    { key: 'usersOnLeave', label: 'Employees on Leave', icon: Clock, color: 'hsl(38,92%,50%)', bg: 'hsla(38,92%,50%,0.12)' },
  ],
  sales: [
    { key: 'weeklyOrders', label: 'Sales Orders (This Week)', icon: ShoppingCart, color: 'hsl(217,91%,60%)', bg: 'hsla(217,91%,60%,0.12)' },
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
  hr: [
    { key: 'totalEmployees', label: 'Total Employees', icon: Factory, color: 'hsl(217,91%,60%)', bg: 'hsla(217,91%,60%,0.12)' },
    { key: 'usersPresent', label: 'Present Today', icon: Activity, color: 'hsl(142,69%,45%)', bg: 'hsla(142,69%,45%,0.12)' },
    { key: 'usersOnLeave', label: 'On Leave Today', icon: Clock, color: 'hsl(38,92%,50%)', bg: 'hsla(38,92%,50%,0.12)' },
  ],
};

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({});
  const [lowStock, setLowStock] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [forecast, setForecast] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const t = Date.now();
        const [s, ls, ra, cd, fc] = await Promise.all([
          api.get('/dashboard/summary', { params: { _t: t } }),
          api.get('/dashboard/low-stock', { params: { _t: t } }),
          api.get('/dashboard/recent-activity', { params: { _t: t } }),
          api.get('/dashboard/sales-chart', { params: { _t: t } }),
          api.get('/dashboard/digital-twin', { params: { _t: t } }),
        ]);
        setSummary(s.data.data || {});
        setLowStock(ls.data.data || []);
        setRecentActivity(ra.data.data || []);
        setForecast((fc.data.data || []).filter(f => f.daysToStockOut !== null && f.daysToStockOut < 30).sort((a, b) => (a.daysToStockOut || 999) - (b.daysToStockOut || 999)).slice(0, 6));

        const days = cd.data.data || [];
        setChartData(days.map(d => ({
          name: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
          Revenue: d.revenue || 0,
          Orders: d.count || 0
        })));
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    load();
  }, []);

  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleDataUpdated = () => {
      const t = Date.now();
      Promise.all([
        api.get('/dashboard/summary', { params: { _t: t } }),
        api.get('/dashboard/low-stock', { params: { _t: t } }),
        api.get('/dashboard/recent-activity', { params: { _t: t } }),
        api.get('/dashboard/sales-chart', { params: { _t: t } }),
        api.get('/dashboard/digital-twin', { params: { _t: t } })
      ]).then(([s, ls, ra, cd, fc]) => {
        setSummary(s.data.data || {});
        setLowStock(ls.data.data || []);
        setRecentActivity(ra.data.data || []);
        setForecast((fc.data.data || []).filter(f => f.daysToStockOut !== null && f.daysToStockOut < 30).sort((a, b) => (a.daysToStockOut || 999) - (b.daysToStockOut || 999)).slice(0, 6));

        const days = cd.data.data || [];
        setChartData(days.map(d => ({
          name: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
          Revenue: d.revenue || 0,
          Orders: d.count || 0
        })));
      });
    };
    socket.on('data_updated', handleDataUpdated);
    return () => socket.off('data_updated', handleDataUpdated);
  }, [socket]);

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
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#cbd5e1' }}
                    formatter={(value, name) => [name === 'Revenue' ? `₹${value.toLocaleString('en-IN')}` : value, name]}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="hsl(217,91%,60%)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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

      {/* Demand Forecast / Digital-Twin Card */}
      {forecast.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'hsla(38,92%,50%,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📈</div>
            <div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 600 }}>Demand Forecast — Stockout Risk</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Products projected to run out within 30 days based on sales velocity</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {forecast.map(f => {
              const urgent = f.daysToStockOut <= 7;
              const warning = f.daysToStockOut <= 14;
              const color = urgent ? 'var(--danger)' : warning ? 'var(--warning)' : 'var(--info)';
              const bg = urgent ? 'var(--danger-bg)' : warning ? 'var(--warning-bg)' : 'var(--info-bg)';
              return (
                <div key={f.product.id} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${color}40`, background: bg }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.product.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    <span>On hand: <strong style={{ color: 'var(--text-primary)' }}>{f.product.onHandQty}</strong></span>
                    <span>Daily demand: <strong style={{ color }}>{f.avgDailyDemand}/day</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color }}>{f.daysToStockOut}</span>
                    <div>
                      <div style={{ fontSize: 11, color, fontWeight: 600 }}>days until stockout</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>at current demand</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 16, fontFamily: 'Outfit', fontSize: 16, fontWeight: 600 }}>
          🕒 Recent Activity
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentActivity.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recent activity</p>
          ) : recentActivity.slice(0, 8).map(log => (
            <div key={log.id} 
                 onClick={() => setSelectedLog(log)}
                 style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 8, transition: 'background 0.2s', cursor: 'pointer' }}>
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
      
      {/* Activity Details Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedLog(null)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h2 className="modal-title">
                <span style={{ marginRight: 8 }}>{getActionIcon(selectedLog.action)}</span>
                Activity Details
              </h2>
              <button className="modal-close" onClick={() => setSelectedLog(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ marginBottom: 16 }}>
                <span className={`badge badge-${selectedLog.model.toLowerCase()}`} style={{ marginRight: 8 }}>{selectedLog.model}</span>
                <span className={`badge badge-draft`}>{selectedLog.action}</span>
              </div>
              
              <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{selectedLog.description}</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                <div>
                  <strong>User:</strong> {selectedLog.user?.name || 'System'}
                </div>
                <div>
                  <strong>Time:</strong> {new Date(selectedLog.timestamp).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
