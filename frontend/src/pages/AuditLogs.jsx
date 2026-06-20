import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { FileText, Search, Filter, X, Download } from 'lucide-react';
import { exportToCSV } from '../utils/export';

export default function AuditLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 50;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [models, setModels] = useState([]);
  const [selectedChanges, setSelectedChanges] = useState(null);

  const fetchLogs = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const params = { limit: LIMIT, page: currentPage };
      if (search) params.search = search;
      if (modelFilter) params.model = modelFilter;
      const { data } = await api.get('/audit', { params });
      
      if (reset) {
        setLogs(data.data || []);
      } else {
        setLogs(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const newLogs = (data.data || []).filter(l => !existingIds.has(l.id));
          return [...prev, ...newLogs];
        });
      }
      setTotal(data.total || 0);
      
      // Extract unique models for the filter dropdown (only on initial load)
      if (!modelFilter && models.length === 0 && data.data) {
        const uniqueModels = [...new Set(data.data.map(l => l.model))];
        setModels(uniqueModels.sort());
      }
    } catch {
      toast.error('Failed to load audit logs');
    }
    setLoading(false);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchLogs(true);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search, modelFilter]);

  useEffect(() => {
    if (page > 1) fetchLogs();
  }, [page]);

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return 'success';
    if (action.includes('UPDATE')) return 'warning';
    if (action.includes('DELETE')) return 'danger';
    if (action.includes('LOGIN')) return 'primary';
    return 'info';
  };

  const handleExport = () => {
    const data = logs.map(l => ({
      Timestamp: new Date(l.timestamp).toLocaleString('en-IN'),
      User: l.user?.name || 'System',
      Action: l.action,
      Model: l.model,
      RecordID: l.recordId || '',
      Description: l.description,
      Amount: l.description.match(/\(Total: ₹([\d,.]+)\)/) ? l.description.match(/\(Total: ₹([\d,.]+)\)/)[1] : ''
    }));
    exportToCSV(data, 'Audit_Logs');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📜 Audit Logs</h1>
          <p className="page-subtitle">Track system-wide activities and changes</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExport} title="Export to CSV" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={15} color="var(--text-muted)" />
            <input
              placeholder="Search descriptions, record IDs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="audit-search"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Filter size={15} color="var(--text-muted)" />
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '6px 30px 6px 12px', fontSize: 13 }}
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}
            >
              <option value="">All Models</option>
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">📜</div>
            <p>No audit logs found.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Model</th>
                <th>Record ID</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const amountMatch = log.description.match(/\(Total: ₹([\d,.]+)\)/);
                let amountDisplay = '—';
                let amountColor = 'var(--text-muted)';
                if (amountMatch) {
                  if (log.model === 'PurchaseOrder') {
                    amountDisplay = `-₹${amountMatch[1]}`;
                    amountColor = 'var(--danger)';
                  } else {
                    amountDisplay = `+₹${amountMatch[1]}`;
                    amountColor = 'var(--success)';
                  }
                }
                return (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(log.timestamp).toLocaleString('en-IN', { 
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{log.user?.name || 'System'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user?.role || 'auto'}</div>
                  </td>
                  <td><span className={`badge badge-${getActionColor(log.action)}`}>{log.action}</span></td>
                  <td><span className={`badge badge-${log.model.toLowerCase()}`}>{log.model}</span></td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {log.recordId}
                  </td>
                  <td style={{ fontSize: 13 }}>{log.description}</td>
                  <td style={{ fontWeight: 600, color: amountColor }}>{amountDisplay}</td>
                  <td>
                    {log.changes && Object.keys(log.changes).length > 0 ? (
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => setSelectedChanges(log)}
                        title="View Changes"
                      >
                        <FileText size={14} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {logs.length < total && !loading && (
          <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary" onClick={() => setPage(p => p + 1)}>Load More</button>
          </div>
        )}
      </div>

      {/* Changes Modal */}
      {selectedChanges && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedChanges(null)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h2 className="modal-title">
                <FileText size={18} style={{ marginRight: 8 }} />
                Audit Log Details
              </h2>
              <button className="modal-close" onClick={() => setSelectedChanges(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ marginBottom: 16 }}>
                <span className={`badge badge-${selectedChanges.model.toLowerCase()}`} style={{ marginRight: 8 }}>{selectedChanges.model}</span>
                <span className={`badge badge-${getActionColor(selectedChanges.action)}`}>{selectedChanges.action}</span>
              </div>
              
              <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', overflowX: 'auto' }}>
                <pre style={{ fontSize: 13, margin: 0, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {JSON.stringify(selectedChanges.changes, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
