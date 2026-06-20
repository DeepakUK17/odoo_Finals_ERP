import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { FileText, Search, Filter } from 'lucide-react';

export default function AuditLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [models, setModels] = useState([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (modelFilter) params.model = modelFilter;
      const { data } = await api.get('/audit', { params });
      setLogs(data.data || []);
      
      // Extract unique models for the filter dropdown
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
      fetchLogs();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search, modelFilter]);

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return 'success';
    if (action.includes('UPDATE')) return 'warning';
    if (action.includes('DELETE')) return 'danger';
    if (action.includes('LOGIN')) return 'primary';
    return 'info';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📜 Audit Logs</h1>
          <p className="page-subtitle">Track system-wide activities and changes</p>
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
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
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
                  <td>
                    {log.changes && Object.keys(log.changes).length > 0 ? (
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => alert(JSON.stringify(log.changes, null, 2))}
                        title="View Changes"
                      >
                        <FileText size={14} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
