import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ShoppingCart, LogOut, Package, ClipboardList } from 'lucide-react';
import Login from './pages/Login';
import Store from './pages/Store';
import Orders from './pages/Orders';

export default function App() {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('store_token');
    const storedUser = localStorage.getItem('store_user');
    if (token && storedUser) setUser(JSON.parse(storedUser));
  }, []);

  const logout = () => {
    localStorage.removeItem('store_token');
    localStorage.removeItem('store_user');
    setUser(null);
    setCart([]);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen">
        {/* Navbar */}
        <nav className="navbar">
          <div className="container flex justify-between items-center">
            <Link to="/" className="logo">
              <Package size={24} />
              <span>Shiv Furniture Store</span>
            </Link>
            
            <div className="nav-links">
              {user ? (
                <>
                  <span className="user-greeting">Hi, {user.name}</span>
                  <Link to="/orders" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none' }}>
                    <ClipboardList size={16} /> My Orders
                  </Link>
                  <div className="cart-icon" onClick={() => document.dispatchEvent(new Event('open-cart'))}>
                    <ShoppingCart size={20} />
                    {cart.length > 0 && <span className="cart-badge">{cart.reduce((s, i) => s + i.qty, 0)}</span>}
                  </div>
                  <button onClick={logout} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LogOut size={16} /> Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn btn-primary">Login / Sign Up</Link>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container main-content">
          <Routes>
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/" element={<Store user={user} cart={cart} setCart={setCart} />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
