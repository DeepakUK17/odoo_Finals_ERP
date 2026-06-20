import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { Plus, Check, Play, Square, Wrench, Search as SearchIcon, Filter, Download, XCircle, X } from 'lucide-react';
import { exportToCSV } from '../utils/export';
import ConfirmModal from '../components/ConfirmModal';

export default function Manufacturing() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 50;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: '', qty: 1, scheduledDate: '', notes: '' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchOrders = async (reset = false, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      const params = { limit: LIMIT, offset: currentPage * LIMIT, _t: Date.now() };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/manufacturing', { params });
      
      if (reset) {
        setOrders(data.data || []);
      } else {
        setOrders(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          const newOrders = (data.data || []).filter(o => !existingIds.has(o.id));
          return [...prev, ...newOrders];
        });
      }
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load manufacturing orders'); }
    if (!silent) setLoading(false);
  };

  const reload = (silent = false) => {
    if (page === 0) fetchOrders(true, silent);
    else setPage(0);
  };

  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleDataUpdated = (data) => {
      if (data.module === 'manufacturing' || data.module === 'products') {
        reload(true);
      }
    };
    socket.on('data_updated', handleDataUpdated);
    return () => socket.off('data_updated', handleDataUpdated);
  }, [socket, page, statusFilter, searchFilter, dateFilter]);

  useEffect(() => { reload(); }, [statusFilter]);
  useEffect(() => { if (page > 0) fetchOrders(); }, [page]);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.data.filter(p => p.canBeManufactured || p.productType === 'finished') || []);
    } catch (err) { toast.error('Failed to load products'); }
  };

  const hasShortage = (mo) => {
    if (!mo || !Array.isArray(mo.moComponents)) return false;
    return mo.moComponents.some(c => {
      if (!c || !c.product) return false;
      const required = Number(c.requiredQty) || 0;
      const onHand = Number(c.product.onHandQty) || 0;
      return onHand < required;
    });
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleCreate = async () => {
    if (!form.productId || !form.qty) { toast.error('Product and quantity required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/manufacturing', { ...form, qty: parseFloat(form.qty) });
      toast.success(`Manufacturing Order ${data.data.orderNo} created!`);
      setShowCreate(false);
      setForm({ productId: '', qty: 1, scheduledDate: '', notes: '' });
      reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Create failed'); }
    setSaving(false);
  };

  const handleConfirm = async (id, orderNo) => {
    try {
      const { data } = await api.post(`/manufacturing/${id}/confirm`);
      if (data.shortages?.length > 0) {
        toast.warning(`${orderNo} confirmed with component shortages!`);
      } else {
        toast.success(`${orderNo} confirmed — components reserved`);
      }
      reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Confirm failed'); }
  };

  const handleComplete = (mo) => {
    setConfirmDialog({
      title: 'Complete Order',
      message: `Complete ${mo.orderNo}? This will consume components and add finished goods to stock.`,
      onConfirm: async () => {
        try {
          const consumptions = mo.moComponents?.map(c => ({ componentId: c.id, consumedQty: c.customConsumed ?? c.requiredQty })) || [];
          await api.post(`/manufacturing/${mo.id}/complete`, { consumptions });
          toast.success(`${mo.orderNo} completed! Finished goods added to inventory.`);
          reload();
          if (selected?.id === mo.id) {
            const { data } = await api.get(`/manufacturing/${mo.id}`);
            setSelected(data.data);
          }
        } catch (err) { toast.error(err.response?.data?.message || 'Complete failed'); }
      }
    });
  };

  const handleCancel = (id, orderNo) => {
    setConfirmDialog({
      title: 'Cancel Order',
      message: `Cancel ${orderNo}? Reserved components will be released.`,
      confirmColor: 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/manufacturing/${id}/cancel`);
          toast.success(`${orderNo} cancelled — components released`);
          if (selected?.id === id) setSelected(null);
          reload();
        } catch (err) { toast.error(err.response?.data?.message || 'Cancel failed'); }
      }
    });
  };

  const handleStartWorkOrder = async (moId, woId) => {
    try {
      await api.post(`/manufacturing/${moId}/work-orders/${woId}/start`);
      toast.success('Work order started!');
      if (selected) {
        const { data } = await api.get(`/manufacturing/${moId}`);
        setSelected(data.data);
      }
      reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleCompleteWorkOrder = async (moId, woId) => {
    try {
      await api.post(`/manufacturing/${moId}/work-orders/${woId}/complete`);
      toast.success('Work order completed!');
      if (selected) {
        const { data } = await api.get(`/manufacturing/${moId}`);
        setSelected(data.data);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const openDetail = async (mo) => {
    try {
      const { data } = await api.get(`/manufacturing/${mo.id}`);
      setSelected(data.data);
    } catch { setSelected(mo); }
  };

  const WO_STATUS_COLOR = { pending: 'var(--warning)', in_progress: 'var(--primary)', completed: 'var(--success)' };

  const filteredOrders = orders.filter(o => {
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      if (!o.orderNo.toLowerCase().includes(q) && !o.product?.name?.toLowerCase().includes(q)) return false;
    }
    if (dateFilter !== 'all') {
      const orderDate = new Date(o.createdAt);
      const now = new Date();
      if (dateFilter === '7days' && (now - orderDate) > 7 * 24 * 60 * 60 * 1000) return false;
      if (dateFilter === '30days' && (now - orderDate) > 30 * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  const handleExport = () => {
    const data = filteredOrders.map(o => ({
      OrderNo: o.orderNo,
      Product: o.product?.name,
      Qty: o.qty,
      Status: o.status,
      Date: new Date(o.createdAt).toLocaleString('en-IN')
    }));
    exportToCSV(data, 'Manufacturing_Orders');
  };

  return (
    <div>
      <ConfirmModal isOpen={!!confirmDialog} {...confirmDialog} onCancel={() => setConfirmDialog(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">🏭 Manufacturing Orders</h1>
          <p className="page-subtitle">Manage production orders and work orders</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport} title="Export to CSV" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> Export
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-mo-btn">
            <Plus size={16} /> New MO
          </button>
        </div>
      </div>

      <div className="table-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="table-search" style={{ flex: 1, minWidth: 200 }}>
          <SearchIcon size={15} color="var(--text-muted)" />
          <input
            placeholder="Search by Order No or Product..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={15} color="var(--text-muted)" />
          <select className="form-select" style={{ width: 'auto', padding: '6px 24px 6px 12px', height: 32 }} value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['', 'draft', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
              {s ? s.replace(/_/g, ' ') : 'All Status'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20 }}>
        {/* Orders Table */}
        <div className="table-wrapper">
          {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
            orders.length === 0 ? (
              <div className="table-empty"><div className="empty-icon">🏭</div><p>No manufacturing orders found.</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Auto?</th>
                    <th>Status</th>
                    <th>Work Orders</th>
                    <th>Scheduled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o)}>
                      <td><strong style={{ color: 'var(--primary-light)' }}>{o.orderNo}</strong></td>
                      <td style={{ fontWeight: 500 }}>{o.product?.name}</td>
                      <td style={{ fontWeight: 600 }}>{o.qty}</td>
                      <td>{o.isAutoCreated ? <span className="badge badge-MTO">Auto (MTO)</span> : <span className="badge badge-draft">Manual</span>}</td>
                      <td><span className={`badge badge-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {o.workOrders?.map(wo => (
                            <span key={wo.id} style={{ width: 10, height: 10, borderRadius: '50%', background: WO_STATUS_COLOR[wo.status], display: 'inline-block' }} title={`${wo.operation}: ${wo.status}`} />
                          ))}
                          {!o.workOrders?.length && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No WOs</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {o.scheduledDate ? new Date(o.scheduledDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {o.status === 'draft' && (
                            <button className="btn btn-sm btn-success" onClick={() => handleConfirm(o.id, o.orderNo)} title="Confirm"><Check size={14} /></button>
                          )}
                          {['confirmed', 'in_progress'].includes(o.status) && (
                            <button 
                              className={`btn btn-sm ${hasShortage(o) ? 'btn-secondary' : 'btn-primary'}`} 
                              onClick={() => {
                                if (hasShortage(o)) {
                                  toast.error('Shortage: Please receive pending Purchase Orders first.');
                                } else {
                                  handleComplete(o);
                                }
                              }}
                              title={hasShortage(o) ? "Missing Components" : "Complete MO"}
                              style={{ opacity: hasShortage(o) ? 0.5 : 1 }}
                            >✅</button>
                          )}
                          {!['completed', 'cancelled'].includes(o.status) && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleCancel(o.id, o.orderNo)} title="Cancel MO">
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {orders.length < total && !loading && (
            <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={() => setPage(p => p + 1)}>Load More</button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card" style={{ position: 'sticky', top: 20, height: 'fit-content', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 700 }}>{selected.orderNo}</h3>
              <button className="modal-close" onClick={() => setSelected(null)}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Product:</span>
                <strong>{selected.product?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Qty:</span>
                <strong>{selected.qty} {selected.product?.unit}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className={`badge badge-${selected.status}`}>{selected.status}</span>
              </div>
            </div>

            {/* Components */}
            {selected.moComponents?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>🔩 Components</h4>
                {selected.moComponents.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-glass)', borderRadius: 6, marginBottom: 4, fontSize: 13, alignItems: 'center' }}>
                    <span>{c.product?.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {['in_progress', 'confirmed'].includes(selected.status) ? (
                        <input 
                          type="number" 
                          min="0"
                          style={{ width: 50, padding: '2px 4px', fontSize: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 4, textAlign: 'right' }}
                          value={c.customConsumed ?? c.requiredQty}
                          onChange={e => {
                            const val = e.target.value;
                            setSelected(s => ({
                              ...s, 
                              moComponents: s.moComponents.map(mc => mc.id === c.id ? { ...mc, customConsumed: val } : mc)
                            }));
                          }}
                        />
                      ) : (
                        <span style={{ color: c.consumedQty >= c.requiredQty ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                          {c.consumedQty}
                        </span>
                      )}
                      <span style={{ color: 'var(--text-muted)' }}>/ {c.requiredQty}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Work Orders */}
            {selected.workOrders?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>⚙️ Work Orders</h4>
                {selected.workOrders.map(wo => (
                  <div key={wo.id} style={{ padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 8, marginBottom: 6, border: `1px solid ${WO_STATUS_COLOR[wo.status]}33` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>#{wo.sequence} {wo.operation}</span>
                      <span className={`badge badge-${wo.status}`}>{wo.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {wo.workCenter?.name} • {wo.duration}h
                      {wo.assignee && ` • ${wo.assignee.name}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {wo.status === 'pending' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleStartWorkOrder(selected.id, wo.id)}>
                          <PlayCircle size={12} /> Start
                        </button>
                      )}
                      {wo.status === 'in_progress' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleCompleteWorkOrder(selected.id, wo.id)}>
                          <CheckCircle size={12} /> Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Complete Button in Detail Panel */}
            {['confirmed', 'in_progress'].includes(selected.status) && (
              <button 
                className={`btn ${hasShortage(selected) ? 'btn-secondary' : 'btn-primary'}`} 
                style={{ width: '100%', justifyContent: 'center', marginTop: 16, opacity: hasShortage(selected) ? 0.5 : 1 }}
                onClick={() => {
                  if (hasShortage(selected)) {
                    toast.error('Cannot complete: You have a shortage of components. Please receive pending Purchase Orders first.');
                  } else {
                    handleComplete(selected);
                  }
                }}
              >
                {hasShortage(selected) ? '⚠️ Waiting for Components to Complete' : '✅ Complete MO & Consume Materials'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">🏭 New Manufacturing Order</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Product *</label>
              <select className="form-select" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} id="mo-product">
                <option value="">Select product to manufacture...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {products.length === 0 && <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>No products with "Can Be Manufactured" enabled. Add a BoM first.</p>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} id="mo-qty" />
              </div>
              <div className="form-group">
                <label className="form-label">Scheduled Date</label>
                <input className="form-input" type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.productId} id="save-mo-btn">
                {saving ? 'Creating...' : '🏭 Create MO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
