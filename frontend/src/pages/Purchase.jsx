import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { Plus, Check, X, PackageCheck, Search as SearchIcon, Filter, Download, XCircle } from 'lucide-react';
import { exportToCSV } from '../utils/export';
import ConfirmModal from '../components/ConfirmModal';

export default function Purchase() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 50;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showReceive, setShowReceive] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor: '', vendorEmail: '', vendorPhone: '', notes: '', items: [{ productId: '', qty: 1, unitPrice: 0 }] });
  const [receipts, setReceipts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchOrders = async (reset = false, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      const params = { limit: LIMIT, offset: currentPage * LIMIT, _t: Date.now() };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/purchase', { params });
      
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
    } catch { toast.error('Failed to load purchase orders'); }
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
      if (data.module === 'purchase' || data.module === 'products') {
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
      setProducts(data.data.filter(p => p.canBePurchased) || []);
    } catch {}
  };

  useEffect(() => { fetchProducts(); }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', qty: 1, unitPrice: 0 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) items[i].unitPrice = prod.costPrice;
    }
    setForm(f => ({ ...f, items }));
  };

  const totalAmount = form.items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0);

  const handleCreate = async () => {
    if (!form.vendor || form.items.some(i => !i.productId)) {
      toast.error('Vendor name and all items are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/purchase', { ...form, items: form.items.map(i => ({ ...i, qty: parseFloat(i.qty), unitPrice: parseFloat(i.unitPrice) })) });
      toast.success('Purchase order created!');
      setShowCreate(false);
      setForm({ vendor: '', vendorEmail: '', vendorPhone: '', notes: '', items: [{ productId: '', qty: 1, unitPrice: 0 }] });
      reload();
    } catch (err) { 
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Create failed';
      toast.error(msg); 
    }
    setSaving(false);
  };

  const handleConfirm = async (id, orderNo) => {
    try {
      await api.post(`/purchase/${id}/confirm`);
      toast.success(`${orderNo} confirmed!`);
      reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Confirm failed'); }
  };

  const openReceive = (order) => {
    setShowReceive(order);
    setReceipts(order.items.map(i => ({ itemId: i.id, receivedQty: i.qty - i.receivedQty, max: i.qty - i.receivedQty, name: i.product?.name })));
  };

  const handleReceive = async () => {
    setSaving(true);
    try {
      await api.post(`/purchase/${showReceive.id}/receive`, { receipts: receipts.map(r => ({ itemId: r.itemId, receivedQty: parseFloat(r.receivedQty) || 0 })) });
      toast.success('Receipt recorded — stock updated!');
      setShowReceive(null);
      reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Receipt failed'); }
    setSaving(false);
  };

  const handleCancel = (id, orderNo) => {
    setConfirmDialog({
      title: 'Cancel Order',
      message: `Cancel ${orderNo}? This cannot be undone.`,
      confirmColor: 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/purchase/${id}/cancel`);
          toast.success(`${orderNo} cancelled`);
          reload();
        } catch (err) { toast.error(err.response?.data?.message || 'Cancel failed'); }
      }
    });
  };

  const getFlowSteps = (status) => [
    { key: 'draft', label: 'Draft', state: status === 'draft' ? 'active' : status !== 'draft' ? 'done' : 'pending' },
    { key: 'confirmed', label: 'Confirmed', state: status === 'confirmed' ? 'active' : ['partially_received', 'fully_received'].includes(status) ? 'done' : 'pending' },
    { key: 'partially_received', label: 'Partial', state: status === 'partially_received' ? 'active' : status === 'fully_received' ? 'done' : 'pending' },
    { key: 'fully_received', label: 'Received', state: status === 'fully_received' ? 'done' : 'pending' },
  ];

  const filteredOrders = orders.filter(o => {
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      if (!o.orderNo.toLowerCase().includes(q) && !o.vendor?.toLowerCase().includes(q)) return false;
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
      Vendor: o.vendor,
      Status: o.status,
      TotalAmount: o.totalAmount,
      Date: new Date(o.createdAt).toLocaleString('en-IN')
    }));
    exportToCSV(data, 'Purchase_Orders');
  };

  return (
    <div>
      <ConfirmModal isOpen={!!confirmDialog} {...confirmDialog} onCancel={() => setConfirmDialog(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">🛒 Purchase Orders</h1>
          <p className="page-subtitle">Manage vendor orders and stock receipts</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport} title="Export to CSV" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> Export
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-po-btn">
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      <div className="table-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="table-search" style={{ flex: 1, minWidth: 200 }}>
          <SearchIcon size={15} color="var(--text-muted)" />
          <input
            placeholder="Search by Order No or Vendor..."
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
          {['', 'draft', 'confirmed', 'partially_received', 'fully_received'].map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
              {s ? s.replace(/_/g, ' ') : 'All Status'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
          orders.length === 0 ? (
            <div className="table-empty"><div className="empty-icon">📋</div><p>No purchase orders found.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>Vendor</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Auto-Created?</th>
                  <th>Status</th>
                  <th>Flow</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => (
                  <tr key={o.id}>
                    <td><strong style={{ color: 'var(--primary-light)' }}>{o.orderNo}</strong></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.vendor}</div>
                      {o.vendorPhone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.vendorPhone}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {o.items?.slice(0, 2).map(i => <div key={i.id}>{i.qty}× {i.product?.name}</div>)}
                      {o.items?.length > 2 && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>+{o.items.length - 2} more</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>₹{o.totalAmount.toLocaleString('en-IN')}</td>
                    <td>{o.isAutoCreated ? <span className="badge badge-MTO">Auto (MTO)</span> : <span className="badge badge-draft">Manual</span>}</td>
                    <td><span className={`badge badge-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                    <td>
                      <div className="pipeline" style={{ gap: 4 }}>
                        {getFlowSteps(o.status).map(s => (
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
                        {['confirmed', 'partially_received'].includes(o.status) && (
                          <button className="btn btn-sm btn-primary" onClick={() => openReceive(o)} title="Receive Stock"><PackageCheck size={14} /></button>
                        )}
                        {!['fully_received', 'cancelled'].includes(o.status) && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleCancel(o.id, o.orderNo)} title="Cancel Order">
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

      {/* Create PO Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">📋 New Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Vendor Name *</label>
                <input className="form-input" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor / Supplier name" id="po-vendor" />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Phone</label>
                <input className="form-input" value={form.vendorPhone} onChange={e => setForm(f => ({ ...f, vendorPhone: e.target.value }))} placeholder="+91-XXXXXXXXXX" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label">Items to Order *</label>
                <button className="btn btn-sm btn-secondary" onClick={addItem}><Plus size={14} /> Add</button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <select className="form-select" value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                    <option value="">Select product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (cost ₹{p.costPrice})</option>)}
                  </select>
                  <input className="form-input" type="number" min="1" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} placeholder="Qty" />
                  <input className="form-input" type="number" min="0" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} placeholder="Unit Cost" />
                  {form.items.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => removeItem(i)}><X size={14} /></button>}
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total Cost: </span>
              <strong style={{ fontSize: 18, color: 'var(--primary-light)' }}>₹{totalAmount.toLocaleString('en-IN')}</strong>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving} id="save-po-btn">
                {saving ? 'Saving...' : '➕ Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceive && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReceive(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">📥 Receive Stock — {showReceive.orderNo}</h2>
              <button className="modal-close" onClick={() => setShowReceive(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Stock will be added to inventory automatically upon receipt.</p>
            {receipts.map((r, i) => (
              <div key={r.itemId} className="form-group">
                <label className="form-label">{r.name} (pending: {r.max})</label>
                <input
                  className="form-input"
                  type="number" min="0" max={r.max}
                  value={r.receivedQty}
                  onChange={e => { const rs = [...receipts]; rs[i].receivedQty = e.target.value; setReceipts(rs); }}
                />
              </div>
            ))}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReceive(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleReceive} disabled={saving}>
                {saving ? 'Saving...' : '✅ Confirm Receipt (+Stock)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
