import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login({ setUser }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '', password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isLogin ? '/login' : '/signup';
      const { data } = await api.post(endpoint, formData);
      localStorage.setItem('store_token', data.token);
      localStorage.setItem('store_user', JSON.stringify(data.user));
      setUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        {isLogin ? 'Welcome Back' : 'Create an Account'}
      </h2>
      
      {error && <div style={{ color: '#ef4444', marginBottom: '1rem', padding: '0.75rem', background: '#fef2f2', borderRadius: '0.375rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
        )}
        
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input className="form-input" required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>

        {!isLogin && (
          <>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Address</label>
              <textarea className="form-input" required rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button onClick={() => setIsLogin(!isLogin)} style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: '500' }}>
          {isLogin ? 'Sign up here' : 'Login here'}
        </button>
      </p>
    </div>
  );
}
