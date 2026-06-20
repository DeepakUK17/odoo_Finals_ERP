import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Users, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const ROLES = ['admin', 'sales', 'purchase', 'manufacturing', 'inventory'];

export default function UserManagement() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  const [form, setForm] = useState({ name: '', email: '', loginId: '', password: '', role: 'sales' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data.data || []);
    } catch {
      toast.error('Failed to load users');
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', loginId: '', password: '', role: 'sales' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, loginId: u.loginId || '', password: '', role: u.role });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email || (!editing && !form.password)) {
      toast.error('Name, Email, and Password are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        // Send password only if it's changed
        const payload = { name: form.name, email: form.email, loginId: form.loginId, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/users/${editing.id}`, payload);
        toast.success(`User ${form.name} updated`);
      } else {
        await api.post('/auth/register', form);
        toast.success(`User ${form.name} created`);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
    setSaving(false);
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser.id) {
      toast.error("You cannot delete yourself.");
      return;
    }
    setConfirmDialog({
      title: 'Delete User',
      message: `Are you sure you want to delete ${u.name}? This action cannot be undone.`,
      confirmColor: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/auth/users/${u.id}`);
          toast.success(`${u.name} deleted`);
          fetchUsers();
        } catch (err) {
          toast.error('Delete failed');
        }
      }
    });
  };

  return (
    <div>
      <ConfirmModal isOpen={!!confirmDialog} {...confirmDialog} onCancel={() => setConfirmDialog(null)} />
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 User Management</h1>
          <p className="page-subtitle">Manage system users, roles, and access</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate} id="add-user-btn">
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">👥</div>
            <p>No users found.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Login ID</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name} {u.id === currentUser.id && '(You)'}</div>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.loginId || <span style={{color: 'var(--text-muted)'}}>No Login ID</span>}</td>
                  <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="btn btn-sm btn-danger" 
                        onClick={() => handleDelete(u)} 
                        title="Delete"
                        disabled={u.id === currentUser.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editing ? '✏️ Edit User' : '➕ New User'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input 
                className="form-input" 
                value={form.name} 
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                placeholder="John Doe" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input 
                className="form-input" 
                type="email"
                value={form.email} 
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                placeholder="john@example.com" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Login ID</label>
              <input 
                className="form-input" 
                value={form.loginId} 
                onChange={e => setForm(f => ({ ...f, loginId: e.target.value }))} 
                placeholder="Unique Username" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Password {editing && <span style={{fontSize: 11, color: 'var(--text-muted)'}}>(leave blank to keep current)</span>}
                {!editing && '*'}
              </label>
              <input 
                className="form-input" 
                type="password"
                value={form.password} 
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
                placeholder="••••••••" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role *</label>
              <select 
                className="form-select" 
                value={form.role} 
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                disabled={editing && editing.id === currentUser.id} // prevent changing own role
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              {editing && editing.id === currentUser.id && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>You cannot change your own role.</p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : <><Check size={16} /> {editing ? 'Update User' : 'Create User'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
