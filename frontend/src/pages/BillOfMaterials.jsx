import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Plus, X, Trash2, Download } from 'lucide-react';
import { exportToCSV } from '../utils/export';
import ConfirmModal from '../components/ConfirmModal';

export default function BillOfMaterials() {
  const toast = useToast();
  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productId: '', qty: 1, reference: '',
    components: [{ productId: '', qty: 1, unit: 'pcs' }],
    workOperations: [{ workCenterId: '', operation: '', duration: 1 }]
  });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [b, p, wc] = await Promise.all([
        api.get('/bom'),
        api.get('/products'),
        api.get('/bom/work-centers/all')
      ]);
      setBoms(b.data.data || []);
      setProducts(p.data.data || []);
      setWorkCenters(wc.data.data || []);
    } catch { toast.error('Failed to load BoM data'); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const addComponent = () => setForm(f => ({ ...f, components: [...f.components, { productId: '', qty: 1, unit: 'pcs' }] }));
  const removeComponent = (i) => setForm(f => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }));
  const updateComponent = (i, field, val) => {
    const comps = [...form.components];
    comps[i] = { ...comps[i], [field]: val };
    setForm(f => ({ ...f, components: comps }));
  };

  const addOperation = () => setForm(f => ({ ...f, workOperations: [...f.workOperations, { workCenterId: '', operation: '', duration: 1 }] }));
  const removeOperation = (i) => setForm(f => ({ ...f, workOperations: f.workOperations.filter((_, idx) => idx !== i) }));
  const updateOperation = (i, field, val) => {
    const ops = [...form.workOperations];
    ops[i] = { ...ops[i], [field]: val };
    setForm(f => ({ ...f, workOperations: ops }));
  };

  const handleSave = async () => {
    if (!form.productId || form.components.some(c => !c.productId)) {
      toast.error('Product and all components are required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        qty: parseFloat(form.qty),
        components: form.components.map(c => ({ ...c, qty: parseFloat(c.qty) })),
        workOperations: form.workOperations.filter(op => op.workCenterId && op.operation).map(op => ({ ...op, duration: parseFloat(op.duration) }))
      };
      
      if (editing) {
        await api.put(`/bom/${editing.id}`, payload);
        toast.success('Bill of Materials updated!');
      } else {
        await api.post('/bom', payload);
        toast.success('Bill of Materials created!');
      }
      
      closeModal();
      fetchAll();
      setSelected(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  const openEdit = (bom) => {
    setForm({
      productId: bom.productId,
      qty: bom.qty,
      reference: bom.reference || '',
      components: bom.components?.length ? bom.components.map(c => ({ productId: c.productId, qty: c.qty, unit: c.unit })) : [{ productId: '', qty: 1, unit: 'pcs' }],
      workOperations: bom.workOperations?.length ? bom.workOperations.map(op => ({ workCenterId: op.workCenterId, operation: op.operation, duration: op.duration })) : [{ workCenterId: '', operation: '', duration: 1 }]
    });
    setEditing(bom);
    setShowCreate(true);
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      title: 'Delete BOM',
      message: 'Are you sure you want to delete this Bill of Materials? This action cannot be undone.',
      confirmColor: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/bom/${id}`);
          toast.success('Bill of Materials deleted successfully');
          setSelected(null);
          fetchAll();
        } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
      }
    });
  };

  const closeModal = () => {
    setShowCreate(false);
    setEditing(null);
    setForm({
      productId: '', qty: 1, reference: '',
      components: [{ productId: '', qty: 1, unit: 'pcs' }],
      workOperations: [{ workCenterId: '', operation: '', duration: 1 }]
    });
  };

  const componentProducts = products.filter(p => p.productType === 'component' || !p.canBeManufactured);
  const finishedProducts = products.filter(p => p.productType === 'finished');

  const handleExport = () => {
    const data = boms.map(b => ({
      Reference: b.reference || b.id,
      Product: products.find(p => p.id === b.productId)?.name || b.productId,
      Qty: b.qty,
      ComponentCount: b.components?.length || 0,
      Components: (b.components || []).map(c => `${c.qty}×${products.find(p => p.id === c.productId)?.name}`).join('; '),
      WorkOperations: (b.workOperations || []).map(op => op.operation).join('; ')
    }));
    exportToCSV(data, 'Bill_of_Materials');
  };

  return (
    <div>
      <ConfirmModal isOpen={!!confirmDialog} {...confirmDialog} onCancel={() => setConfirmDialog(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Bill of Materials</h1>
          <p className="page-subtitle">Define product recipes, components, and work operations</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> Export
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowCreate(true); }} id="create-bom-btn">
            <Plus size={16} /> New BoM
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20 }}>
        {/* BoM List */}
        <div className="table-wrapper">
          {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
            boms.length === 0 ? (
              <div className="table-empty"><div className="empty-icon">📄</div><p>No Bills of Materials yet.</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Reference</th>
                    <th>Produces Qty</th>
                    <th>Components</th>
                    <th>Work Operations</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {boms.map(b => (
                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(b)}>
                      <td><strong style={{ color: 'var(--primary-light)' }}>{b.product?.name}</strong></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.reference || '—'}</td>
                      <td>{b.qty} {b.product?.unit || 'pcs'}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {b.components?.slice(0, 3).map(c => (
                            <span key={c.id} className="badge badge-component" style={{ fontSize: 11 }}>{c.qty}× {c.product?.name}</span>
                          ))}
                          {b.components?.length > 3 && <span className="badge badge-draft" style={{ fontSize: 11 }}>+{b.components.length - 3}</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {b.workOperations?.map(op => (
                            <span key={op.id} className="badge badge-in_progress" style={{ fontSize: 11 }}>#{op.sequence} {op.operation}</span>
                          ))}
                          {!b.workOperations?.length && <span className="badge badge-draft" style={{ fontSize: 11 }}>None</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* BoM Detail Panel */}
        {selected && (
          <div className="card" style={{ position: 'sticky', top: 20, height: 'fit-content', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 700 }}>
                📄 {selected.product?.name}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(selected)}>✏️ Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>🗑️ Delete</button>
                <button className="modal-close" onClick={() => setSelected(null)}><X size={16} /></button>
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Produces: <strong style={{ color: 'var(--text-primary)' }}>{selected.qty} {selected.product?.unit || 'pcs'}</strong>
              {selected.reference && <> • Ref: {selected.reference}</>}
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🔩 Components:</h4>
            {selected.components?.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.product?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stock: {c.product?.onHandQty} {c.product?.unit}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-light)' }}>{c.qty} {c.unit}</div>
                  <div style={{ fontSize: 11, color: c.product?.onHandQty >= c.qty ? 'var(--success)' : 'var(--danger)' }}>
                    {c.product?.onHandQty >= c.qty ? '✅ Available' : '⚠️ Short'}
                  </div>
                </div>
              </div>
            ))}

            {selected.workOperations?.length > 0 && (
              <>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px' }}>⚙️ Work Operations:</h4>
                {selected.workOperations.map(op => (
                  <div key={op.id} style={{ padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>#{op.sequence} {op.operation}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{op.workCenter?.name} • {op.duration}h</div>
                  </div>
                ))}
              </>
            )}

            <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg-glass)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Estimated Cost:</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-light)' }}>
                ₹{(selected.components?.reduce((s, c) => s + (c.qty * (c.product?.costPrice || 0)), 0) || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit BoM Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal modal-xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? '✏️ Edit Bill of Materials' : '📄 New Bill of Materials'}</h2>
              <button className="modal-close" onClick={closeModal}><X size={18} /></button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Finished Product *</label>
                <select className="form-select" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} id="bom-product" disabled={!!editing}>
                  <option value="">Select finished product...</option>
                  {finishedProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Produces Qty</label>
                <input className="form-input" type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reference (optional)</label>
              <input className="form-input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. BOM-TABLE-001" />
            </div>

            {/* Components */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label">🔩 Components *</label>
                <button className="btn btn-sm btn-secondary" onClick={addComponent}><Plus size={14} /> Add</button>
              </div>
              {form.components.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <select className="form-select" value={c.productId} onChange={e => updateComponent(i, 'productId', e.target.value)}>
                    <option value="">Select component...</option>
                    {componentProducts.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.onHandQty})</option>)}
                  </select>
                  <input className="form-input" type="number" min="0.1" step="0.1" value={c.qty} onChange={e => updateComponent(i, 'qty', e.target.value)} placeholder="Qty" />
                  <select className="form-select" value={c.unit} onChange={e => updateComponent(i, 'unit', e.target.value)}>
                    {['pcs', 'units', 'kg', 'meters', 'liters'].map(u => <option key={u}>{u}</option>)}
                  </select>
                  {form.components.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => removeComponent(i)}><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>

            {/* Work Operations */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label">⚙️ Work Operations (optional)</label>
                <button className="btn btn-sm btn-secondary" onClick={addOperation}><Plus size={14} /> Add</button>
              </div>
              {form.workOperations.map((op, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <select className="form-select" value={op.workCenterId} onChange={e => updateOperation(i, 'workCenterId', e.target.value)}>
                    <option value="">Work center...</option>
                    {workCenters.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                  </select>
                  <input className="form-input" value={op.operation} onChange={e => updateOperation(i, 'operation', e.target.value)} placeholder="Operation name" />
                  <input className="form-input" type="number" min="0.5" step="0.5" value={op.duration} onChange={e => updateOperation(i, 'duration', e.target.value)} placeholder="Hours" />
                  {form.workOperations.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => removeOperation(i)}><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-bom-btn">
                {saving ? 'Saving...' : (editing ? '💾 Save Changes' : '📄 Create BoM')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
