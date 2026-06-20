import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { TrendingUp, TrendingDown, Filter, Search, Download, Package } from 'lucide-react';
import { exportToCSV } from '../utils/export';

const TYPE_LABELS = {
  sale_delivery: { label: 'Sale Delivery', color: 'var(--danger)', icon: '📦', dir: 'out' },
  purchase_receipt: { label: 'Purchase Receipt', color: 'var(--success)', icon: '📥', dir: 'in' },
  manufacturing_consumption: { label: 'Mfg Consumption', color: 'var(--warning)', icon: '⚙️', dir: 'out' },
  manufacturing_output: { label: 'Mfg Output', color: 'var(--success)', icon: '🏭', dir: 'in' },
  adjustment: { label: 'Adjustment', color: 'var(--info)', icon: '🔧', dir: 'in' },
  opening_stock: { label: 'Opening Stock', color: 'var(--primary)', icon: '🗃️', dir: 'in' },
};

export default function StockMovements() {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const fetchEntries = async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;
    try {
      const params = { limit: LIMIT, offset: currentPage * LIMIT };
      if (productFilter) params.productId = productFilter;
      if (typeFilter) params.type = typeFilter;
      const { data } = await api.get('/stock-ledger', { params });
      setEntries(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load stock movements'); }
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.data || []);
    } catch {}
  };

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { setPage(0); fetchEntries(true); }, [productFilter, typeFilter]);
  useEffect(() => { if (page > 0) fetchEntries(); }, [page]);

  const filteredEntries = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.product?.name?.toLowerCase().includes(q) ||
      e.reference?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  });

  const handleExport = () => {
    const data = filteredEntries.map(e => ({
      Date: new Date(e.createdAt).toLocaleString('en-IN'),
      Product: e.product?.name,
      Type: TYPE_LABELS[e.type]?.label || e.type,
      Qty: e.qty > 0 ? `+${e.qty}` : e.qty,
      BalanceQty: e.balanceQty,
      Reference: e.reference,
      Description: e.description || ''
    }));
    exportToCSV(data, 'Stock_Movements');
  };

  const totalIn = filteredEntries.filter(e => e.qty > 0).reduce((s, e) => s + e.qty, 0);
  const totalOut = filteredEntries.filter(e => e.qty < 0).reduce((s, e) => s + Math.abs(e.qty), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Stock Movements</h1>
          <p className="page-subtitle">Full traceability of every stock entry and exit</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>+{totalIn.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Stock In (filtered)</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingDown size={20} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>-{totalOut.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Stock Out (filtered)</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'hsla(217,91%,60%,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{total.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Transactions</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="table-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div className="table-search" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            placeholder="Search by product, reference, description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={15} color="var(--text-muted)" />
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 28px 6px 12px', height: 32, fontSize: 13 }}
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
          >
            <option value="">All Products</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '6px 28px 6px 12px', height: 32, fontSize: 13 }}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : filteredEntries.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">📊</div>
            <p>No stock movements found.</p>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Reference</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => {
                  const meta = TYPE_LABELS[entry.type] || { label: entry.type, color: 'var(--text-muted)', icon: '📝' };
                  const isIn = entry.qty > 0;
                  return (
                    <tr key={entry.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(entry.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{entry.product?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.product?.unit}</div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${meta.color}18`, color: meta.color, fontWeight: 500 }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isIn ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                        {isIn ? '+' : ''}{entry.qty}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {entry.balanceQty}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                          {entry.reference}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280 }}>
                        {entry.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Showing {Math.min((page * LIMIT) + 1, total)}–{Math.min((page + 1) * LIMIT, total)} of {total} entries
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  ← Prev
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}>
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
