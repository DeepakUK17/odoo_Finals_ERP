import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  const fillDemo = (role) => {
    const creds = {
      admin: ['admin@shiv.com', 'Admin@123'],
      sales: ['sales@shiv.com', 'Sales@123'],
      purchase: ['purchase@shiv.com', 'Purchase@123'],
      mfg: ['mfg@shiv.com', 'Mfg@123'],
      inventory: ['inventory@shiv.com', 'Inv@123'],
    };
    setEmail(creds[role][0]);
    setPassword(creds[role][1]);
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🪑</div>
          <div>
            <h1><span>Shiv</span>ERP</h1>
            <p>Furniture Works Management</p>
          </div>
        </div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to access your ERP dashboard</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email or Login ID</label>
            <input
              id="login-email"
              type="text"
              className="form-input"
              placeholder="admin@shiv.com or mylogin123"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          


          {error && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
              ❌ {error}
            </div>
          )}

          <button id="login-submit-btn" type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : '→ Sign In'}
          </button>
        </form>



        <div className="login-demo-creds">
          <h4>🧪 Quick Demo Login</h4>
          {['admin', 'sales', 'purchase', 'mfg', 'inventory'].map(role => (
            <div key={role} className="demo-cred" style={{ cursor: 'pointer' }} onClick={() => fillDemo(role)}>
              <b>{role === 'admin' ? 'Business Owner (Admin)' : role.charAt(0).toUpperCase() + role.slice(1)}</b>
              <span>{role === 'mfg' ? 'mfg@shiv.com' : `${role}@shiv.com`}</span>
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Click a role to auto-fill credentials</p>
        </div>
      </div>
    </div>
  );
}
