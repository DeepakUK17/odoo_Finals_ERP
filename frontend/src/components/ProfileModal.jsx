import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    password: '',
    avatarUrl: user?.avatarUrl || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      setLoading(true);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setForm(f => ({ ...f, avatarUrl: res.data.url }));
        toast.success('Image uploaded successfully');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload image');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await api.put('/auth/profile', form);
      if (res.data.success) {
        toast.success('Profile updated successfully!');
        updateUser(res.data.user);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
    setLoading(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title">👤 Edit Profile</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          {error && <div style={{ color: 'var(--danger)', marginBottom: 15, fontSize: 13 }}>❌ {error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border)', overflow: 'hidden', margin: '0 auto 10px' }}>
                  {form.avatarUrl ? (
                    <img src={form.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 32, color: 'var(--text-muted)' }}>{user?.name?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="form-group">
                  <label className="form-label">{user?.avatarUrl ? 'Update Profile Photo' : 'Upload Profile Photo'}</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    className="form-input"
                    onChange={handleFileUpload}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Select a PNG or JPEG file to upload</div>
                </div>
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Login Details (Read-only)</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <input className="form-input" value={user?.email || ''} disabled style={{ flex: 1 }} />
                <input className="form-input" value={user?.loginId || 'No Login ID'} disabled style={{ flex: 1 }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Change Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Leave blank to keep current password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                If changing: 8+ chars, 1 Uppercase, 1 Lowercase, 1 Special Char
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
