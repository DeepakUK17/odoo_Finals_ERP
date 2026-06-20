import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Plus, Eye, Check, X, Truck, ChevronDown } from 'lucide-react';

const STATUS_ORDER = ['draft', 'confirmed', 'partially_delivered', 'fully_delivered', 'cancelled'];

export default function Sales() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showDeliver, setShowDeliver] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [procResult, setProcResult] = useState(null);

  // Create form
  const [form, setForm] = useState({ customer: '', customerEmail: '', customerPhone: '', notes: '', items: [{ productId: '', qty: 1, unitPrice: 0 }] });
  // Deliver form
  const [deliveries, setDeliveries] = useState([]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get('/sales', { params });
      setOrders(data.data || []);
    } catch { toast.error('Failed to load sales orders'); }
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products', { params: { type: 'finished' } });
      setProducts(data.data.filter(p => p.canBeSold) || []);
    } catch {}
  };

  useEffect(() => { fetchOrders(); fetchProducts(); }, [statusFilter]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', qty: 1, unitPrice: 0 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) items[i].unitPrice = prod.salesPrice;
    }
    setForm(f => ({ ...f, items }));
  };

  const totalAmount = form.items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0);

  const handleCreate = async () => {
    if (!form.customer || form.items.some(i => !i.productId)) {
      toast.error('Customer name and all items are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/sales', { ...form, items: form.items.map(i => ({ ...i, qty: parseFloat(i.qty), unitPrice: parseFloat(i.unitPrice) })) });
      toast.success('Sales order created!');
      setShowCreate(false);
      setForm({ customer: '', customerEmail: '', customerPhone: '', notes: '', items: [{ productId: '', qty: 1, unitPrice: 0 }] });
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Create failed'); }
    setSaving(false);
  };

  const handleConfirm = async (id, orderNo) => {
    try {
      const { data } = await api.post(`/sales/${id}/confirm`);
      toast.success(`${orderNo} confirmed!`);
      if (data.procurementActions?.length > 0) {
        setProcResult({ orderNo, actions: data.procurementActions });
      }
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Confirm failed'); }
  };

  const openDeliver = (order) => {
    setShowDeliver(order);
    setDeliveries(order.items.map(i => ({ itemId: i.id, deliveredQty: i.qty - i.deliveredQty, max: i.qty - i.deliveredQty, name: i.product?.name })));
  };

  const handleDeliver = async () => {
    setSaving(true);
    try {
      await api.post(`/sales/${showDeliver.id}/deliver`, { deliveries: deliveries.map(d => ({ itemId: d.itemId, deliveredQty: parseFloat(d.deliveredQty) || 0 })) });
      toast.success('Delivery recorded!');
      setShowDeliver(null);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Delivery failed'); }
    setSaving(false);
  };

  const handleCancel = async (id, orderNo) => {
    if (!confirm(`Cancel ${orderNo}?`)) return;
    try {
      await api.post(`/sales/${id}/cancel`);
      toast.success(`${orderNo} cancelled`);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Cancel failed'); }
  };

  const getFlowSteps = (status) => {
    const steps = [
      { key: 'draft', label: 'Draft' },
      { key: 'confirmed', label: 'Confirmed' },
      { key: 'partially_delivered', label: 'Partial' },
      { key: 'fully_delivered', label: 'Delivered' },
    ];
    const idx = STATUS_ORDER.indexOf(status);
    return steps.map((s, i) => ({
      ...s,
      state: i < idx ? 'done' : s.key === status ? 'active' : 'pending'
    }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛒 Sales Orders</h1>
          <p className="page-subtitle">Manage customer orders and deliveries</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-so-btn">
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'draft', 'confirmed', 'partially_delivered', 'fully_delivered', 'cancelled'].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      <div className="table-wrapper">
        {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
          orders.length === 0 ? (
            <div className="table-empty"><div className="empty-icon">🛒</div><p>No sales orders found.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Flow</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><strong style={{ color: 'var(--primary-light)' }}>{o.orderNo}</strong></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.customer}</div>
                      {o.customerPhone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.customerPhone}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {o.items?.slice(0, 2).map(i => <div key={i.id}>{i.qty}× {i.product?.name}</div>)}
                      {o.items?.length > 2 && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>+{o.items.length - 2} more</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>₹{o.totalAmount.toLocaleString('en-IN')}</td>
                    <td><span className={`badge badge-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                    <td>
                      <div className="pipeline" style={{ gap: 4 }}>
                        {getFlowSteps(o.status).map((s, i) => (
                          <span key={s.key} className={`pipeline-step ${s.state}`} style={{ fontSize: 10, padding: '3px 8px' }}>{s.label}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {o.status === 'draft' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleConfirm(o.id, o.orderNo)} title="Confirm"><Check size={14} /></button>
                        )}
                        {['confirmed', 'partially_delivered'].includes(o.status) && (
                          <button className="btn btn-sm btn-primary" onClick={() => openDeliver(o)} title="Deliver"><Truck size={14} /></button>
                        )}
                        {!['fully_delivered', 'cancelled'].includes(o.status) && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleCancel(o.id, o.orderNo)} title="Cancel"><X size={14} /></button>
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

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">🛒 New Sales Order</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input className="form-input" value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="Customer name" id="so-customer-name" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="+91-XXXXXXXXXX" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="customer@email.com" />
            </div>

            {/* Items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label">Order Items *</label>
                <button className="btn btn-sm btn-secondary" onClick={addItem}><Plus size={14} /> Add Item</button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <select className="form-select" value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                    <option value="">Select product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.salesPrice})</option>)}
                  </select>
                  <input className="form-input" type="number" min="1" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} placeholder="Qty" />
                  <input className="form-input" type="number" min="0" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} placeholder="Unit Price" />
                  {form.items.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => removeItem(i)}><X size={14} /></button>}
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total Amount: </span>
              <strong style={{ fontSize: 18, color: 'var(--primary-light)' }}>₹{totalAmount.toLocaleString('en-IN')}</strong>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving} id="save-so-btn">
                {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : '➕ Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliver Modal */}
      {showDeliver && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeliver(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">📦 Record Delivery — {showDeliver.orderNo}</h2>
              <button className="modal-close" onClick={() => setShowDeliver(null)}><X size={18} /></button>
            </div>
            {deliveries.map((d, i) => (
              <div key={d.itemId} className="form-group">
                <label className="form-label">{d.name} (max: {d.max})</label>
                <input
                  className="form-input"
                  type="number" min="0" max={d.max}
                  value={d.deliveredQty}
                  onChange={e => { const ds = [...deliveries]; ds[i].deliveredQty = e.target.value; setDeliveries(ds); }}
                />
              </div>
            ))}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeliver(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleDeliver} disabled={saving}>
                {saving ? 'Saving...' : '✅ Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Procurement Result Toast */}
      {procResult && (
        <div className="modal-overlay" onClick={() => setProcResult(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">🤖 MTO — Auto Procurement Triggered!</h2>
              <button className="modal-close" onClick={() => setProcResult(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {procResult.orderNo} was confirmed. The following were auto-created due to insufficient stock:
            </p>
            {procResult.actions.map((a, i) => (
              <div key={i} className="risk-card" style={{ marginBottom: 10 }}>
                <div className={`risk-dot ${a.type === 'manufacturing_order' ? 'medium' : 'high'}`} />
                <div>
                  <div className="risk-title">
                    {a.type === 'manufacturing_order' ? '🏭 Manufacturing Order' : '🛒 Purchase Order'} — {a.orderNo}
                  </div>
                  <div className="risk-detail">{a.qty} × {a.productName}</div>
                </div>
              </div>
            ))}
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setProcResult(null)}>Got it!</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
