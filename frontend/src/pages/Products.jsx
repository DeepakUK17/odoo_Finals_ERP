import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Plus, Search, Edit2, Trash2, X, Check, Download } from 'lucide-react';
import { exportToCSV } from '../utils/export';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY_FORM = {
  name: '', description: '', salesPrice: '', costPrice: '',
  onHandQty: '', minStockLevel: '10', reorderQty: '0', productType: 'finished',
  procurementType: 'MTS', procurementRoute: 'purchase',
  canBeSold: true, canBePurchased: true, canBeManufactured: false, unit: 'pcs',
  preferredVendorName: '', preferredVendorEmail: ''
};

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const { data } = await api.get('/products', { params });
      setProducts(data.data || []);
    } catch { toast.error('Failed to load products'); }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [search, filterType]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || '',
      salesPrice: p.salesPrice, costPrice: p.costPrice,
      onHandQty: p.onHandQty, minStockLevel: p.minStockLevel, reorderQty: p.reorderQty || 0,
      productType: p.productType, procurementType: p.procurementType,
      procurementRoute: p.procurementRoute, canBeSold: p.canBeSold,
      canBePurchased: p.canBePurchased, canBeManufactured: p.canBeManufactured, unit: p.unit,
      preferredVendorName: p.preferredVendorName || '',
      preferredVendorEmail: p.preferredVendorEmail || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.salesPrice || !form.costPrice) {
      toast.error('Name, Sales Price, and Cost Price are required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        salesPrice: parseFloat(form.salesPrice),
        costPrice: parseFloat(form.costPrice) || 0,
        onHandQty: parseFloat(form.onHandQty) || 0,
        minStockLevel: parseFloat(form.minStockLevel) || 10,
        reorderQty: parseFloat(form.reorderQty) || 0
      };
      if (editing) {
        await api.put(`/products/${editing.id}`, body);
        toast.success(`Product "${form.name}" updated`);
      } else {
        await api.post('/products', body);
        toast.success(`Product "${form.name}" created`);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
    setSaving(false);
  };

  const handleDelete = (p) => {
    setConfirmDialog({
      title: 'Archive Product',
      message: `Archive "${p.name}"? It will no longer appear in new orders.`,
      confirmColor: 'danger',
      confirmText: 'Archive',
      onConfirm: async () => {
        try {
          await api.delete(`/products/${p.id}`);
          toast.success(`${p.name} archived`);
          fetchProducts();
        } catch { toast.error('Delete failed'); }
      }
    });
  };

  const stockStatus = (p) => {
    if (p.onHandQty === 0) return { label: 'Out of Stock', cls: 'cancelled' };
    if (p.onHandQty <= p.minStockLevel) return { label: 'Low Stock', cls: 'partially_delivered' };
    return { label: 'In Stock', cls: 'fully_delivered' };
  };

  const handleExport = () => {
    const data = products.map(p => ({
      Name: p.name, Type: p.productType, Unit: p.unit,
      SalesPrice: p.salesPrice, CostPrice: p.costPrice,
      OnHand: p.onHandQty, Reserved: p.reservedQty, Available: Math.max(0, p.onHandQty - (p.reservedQty || 0)),
      MinStock: p.minStockLevel, ReorderQty: p.reorderQty,
      ProcurementRoute: p.procurementRoute, PreferredVendor: p.preferredVendorName || ''
    }));
    exportToCSV(data, 'Products_Catalog');
  };

  return (
    <div>
      <ConfirmModal isOpen={!!confirmDialog} {...confirmDialog} onCancel={() => setConfirmDialog(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Products</h1>
          <p className="page-subtitle">Manage your product catalog and inventory</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> Export
          </button>
          <button className="btn btn-primary" onClick={openCreate} id="add-product-btn">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={15} color="var(--text-muted)" />
            <input
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="product-search"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'finished', 'component'].map(t => (
              <button
                key={t}
                className={`btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterType(t)}
              >
                {t ? (t === 'finished' ? '✅ Finished' : '🔩 Component') : 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /><span>Loading products...</span></div>
        ) : products.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">📦</div>
            <p>No products found. <a href="#" onClick={e => { e.preventDefault(); openCreate(); }} style={{ color: 'var(--primary)' }}>Create one!</a></p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Procurement</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Free to Use</th>
                <th>Min Level</th>
                <th>Status</th>
                <th>Sales Price</th>
                <th>Cost Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const st = stockStatus(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.description.slice(0, 40)}</div>}
                    </td>
                    <td><span className={`badge badge-${p.productType}`}>{p.productType}</span></td>
                    <td><span className={`badge badge-${p.procurementType}`}>{p.procurementType}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.onHandQty} {p.unit}</td>
                    <td style={{ color: 'var(--warning)' }}>{p.reservedQty}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{p.freeToUseQty}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.minStockLevel}</td>
                    <td><span className={`badge badge-${st.cls}`}>{st.label}</span></td>
                    <td>₹{p.salesPrice.toLocaleString('en-IN')}</td>
                    <td>₹{p.costPrice.toLocaleString('en-IN')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)} title="Edit"><Edit2 size={14} /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)} title="Archive"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? '✏️ Edit Product' : '➕ New Product'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Wooden Table" id="product-name-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {['pcs', 'units', 'kg', 'meters', 'sets'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Sales Price (₹) *</label>
                <input className="form-input" type="number" min="0" value={form.salesPrice} onChange={e => setForm(f => ({ ...f, salesPrice: e.target.value }))} placeholder="2500" id="product-sales-price" />
              </div>
              <div className="form-group">
                <label className="form-label">Cost Price (₹) *</label>
                <input className="form-input" type="number" min="0" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} placeholder="1200" />
              </div>
              <div className="form-group">
                <label>Min Stock Level (Alert)</label>
                <input className="form-input" type="number" min="0" value={form.minStockLevel} onChange={e => setForm(f => ({ ...f, minStockLevel: e.target.value }))} placeholder="10" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Reorder Qty (Auto PO)</label>
                <input className="form-input" type="number" min="0" value={form.reorderQty} onChange={e => setForm(f => ({ ...f, reorderQty: e.target.value }))} placeholder="0 (Disable)" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Product Type</label>
                <select className="form-select" value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))}>
                  <option value="finished">Finished Good</option>
                  <option value="component">Component / Raw Material</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Procurement Type</label>
                <select className="form-select" value={form.procurementType} onChange={e => setForm(f => ({ ...f, procurementType: e.target.value }))}>
                  <option value="MTS">MTS — Make to Stock</option>
                  <option value="MTO">MTO — Make to Order</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Procurement Route</label>
                <select className="form-select" value={form.procurementRoute} onChange={e => setForm(f => ({ ...f, procurementRoute: e.target.value }))}>
                  <option value="purchase">Purchase from Vendor</option>
                  <option value="manufacturing">Manufacture In-House</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">On Hand Qty (opening)</label>
                <input className="form-input" type="number" min="0" value={form.onHandQty} onChange={e => setForm(f => ({ ...f, onHandQty: e.target.value }))} placeholder="0" disabled={!!editing} />
              </div>
            </div>

            {/* Preferred Vendor (for auto-PO) */}
            {(form.procurementRoute === 'purchase' || form.canBePurchased) && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Preferred Vendor Name</label>
                  <input className="form-input" value={form.preferredVendorName} onChange={e => setForm(f => ({ ...f, preferredVendorName: e.target.value }))} placeholder="e.g. Raja Timber Suppliers" />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Used for auto-generated Purchase Orders</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Vendor Email</label>
                  <input className="form-input" type="email" value={form.preferredVendorEmail} onChange={e => setForm(f => ({ ...f, preferredVendorEmail: e.target.value }))} placeholder="vendor@example.com" />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              {[['canBeSold', 'Can Be Sold'], ['canBePurchased', 'Can Be Purchased'], ['canBeManufactured', 'Can Be Manufactured']].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-product-btn">
                {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : <><Check size={16} /> {editing ? 'Update Product' : 'Create Product'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
