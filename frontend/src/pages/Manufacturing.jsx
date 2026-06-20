import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Plus, CheckCircle, X, PlayCircle } from 'lucide-react';

export default function Manufacturing() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: '', qty: 1, scheduledDate: '', notes: '' });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get('/manufacturing', { params });
      setOrders(data.data || []);
    } catch { toast.error('Failed to load manufacturing orders'); }
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.data.filter(p => p.canBeManufactured) || []);
    } catch {}
  };

  useEffect(() => { fetchOrders(); fetchProducts(); }, [statusFilter]);

  const handleCreate = async () => {
    if (!form.productId || !form.qty) { toast.error('Product and quantity required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/manufacturing', { ...form, qty: parseFloat(form.qty) });
      toast.success(`Manufacturing Order ${data.data.orderNo} created!`);
      setShowCreate(false);
      setForm({ productId: '', qty: 1, scheduledDate: '', notes: '' });
      fetchOrders();
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
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Confirm failed'); }
  };

  const handleComplete = async (id, orderNo) => {
    if (!confirm(`Complete ${orderNo}? This will consume components and add finished goods to stock.`)) return;
    try {
      await api.post(`/manufacturing/${id}/complete`);
      toast.success(`${orderNo} completed! Finished goods added to inventory.`);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Complete failed'); }
  };

  const handleStartWorkOrder = async (moId, woId) => {
    try {
      await api.post(`/manufacturing/${moId}/work-orders/${woId}/start`);
      toast.success('Work order started!');
      if (selected) {
        const { data } = await api.get(`/manufacturing/${moId}`);
        setSelected(data.data);
      }
      fetchOrders();
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏭 Manufacturing Orders</h1>
          <p className="page-subtitle">Manage production orders and work orders</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-mo-btn">
          <Plus size={16} /> New MO
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'draft', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
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
                  {orders.map(o => (
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
                            <button className="btn btn-sm btn-success" onClick={() => handleConfirm(o.id, o.orderNo)} title="Confirm"><CheckCircle size={14} /></button>
                          )}
                          {['confirmed', 'in_progress'].includes(o.status) && (
                            <button className="btn btn-sm btn-primary" onClick={() => handleComplete(o.id, o.orderNo)} title="Complete MO">✅</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
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
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-glass)', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                    <span>{c.product?.name}</span>
                    <span style={{ color: c.consumedQty >= c.requiredQty ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                      {c.consumedQty}/{c.requiredQty}
                    </span>
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
