import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Check, PackageOpen } from 'lucide-react';
import api from '../api';

import officeChairImg from '../assets/Office Chair.jpeg';
import woodenShelfImg from '../assets/Wooden Shelf.jpeg';
import woodenTableImg from '../assets/Wooden Table.jpeg';
import diningTableImg from '../assets/dining table.jpeg';

const imageMap = {
  'Office Chair': officeChairImg,
  'Wooden Shelf': woodenShelfImg,
  'Wooden Table': woodenTableImg,
  'Dining Table': diningTableImg
};

export default function Store({ user, cart, setCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await api.get('/products');
        setProducts(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
    const handleOpenCart = () => setIsCartOpen(true);
    document.addEventListener('open-cart', handleOpenCart);
    return () => document.removeEventListener('open-cart', handleOpenCart);
  }, []);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.salesPrice, qty: 1 }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.productId === productId) {
        const newQty = Math.max(0, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }).filter(i => i.qty > 0));
  };

  const handleCheckout = async () => {
    setCheckoutError('');
    if (!user) {
      setCheckoutError("Please login to place an order.");
      return;
    }
    setCheckingOut(true);
    try {
      const { data } = await api.post('/checkout', { cart });
      setOrderSuccess(data.orderNo);
      setCart([]);
    } catch (err) {
      setCheckoutError(err.response?.data?.error || "Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading products...</div>;

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h2>Available Products</h2>
        {cart.length > 0 && (
          <button className="btn btn-primary flex items-center" style={{ gap: '0.5rem' }} onClick={() => setIsCartOpen(true)}>
            <ShoppingCart size={18} /> View Cart ({cart.reduce((s, i) => s + i.qty, 0)})
          </button>
        )}
      </div>

      <div className="grid grid-cols-3">
        {products.map(p => {
          const imgSrc = imageMap[p.name];
          return (
            <div key={p.id} className="card">
              <div className="product-image" style={{ background: imgSrc ? '#fff' : '#e5e7eb', padding: imgSrc ? 0 : '1.25rem' }}>
                {imgSrc ? (
                  <img src={imgSrc} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <PackageOpen size={48} opacity={0.5} />
                )}
              </div>
              <div className="product-info">
                <h3 className="product-title">{p.name}</h3>
                <p className="product-desc">{p.description || "Premium furniture"}</p>
                <div className="flex justify-between items-center">
                  <span className="product-price">${p.salesPrice.toFixed(2)}</span>
                  <button className="btn btn-outline flex items-center" style={{ gap: '0.25rem' }} onClick={() => addToCart(p)}>
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isCartOpen && (
        <div className="cart-modal">
          <div className="cart-content">
            {orderSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ background: '#d1fae5', color: '#059669', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                  <Check size={32} />
                </div>
                <h3>Order Placed Successfully!</h3>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Your order number is <strong>{orderSuccess}</strong>.</p>
                <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => { setIsCartOpen(false); setOrderSuccess(null); }}>
                  Continue Shopping
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, color: 'var(--primary)' }}>Your Shopping Cart</h2>
                </div>
                
                {checkoutError && (
                  <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#fef2f2', color: '#ef4444', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                    {checkoutError}
                  </div>
                )}

                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                    <ShoppingCart size={48} opacity={0.2} style={{ margin: '0 auto 1rem auto' }} />
                    <p>Your cart is empty.</p>
                  </div>
                ) : (
                  <div>
                    {cart.map(item => (
                      <div key={item.productId} className="cart-item">
                        <div>
                          <div style={{ fontWeight: 500 }}>{item.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>${item.price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center" style={{ gap: '1rem' }}>
                          <button onClick={() => updateQty(item.productId, -1)} className="btn btn-outline" style={{ padding: '0.25rem' }}><Minus size={14}/></button>
                          <span>{item.qty}</span>
                          <button onClick={() => updateQty(item.productId, 1)} className="btn btn-outline" style={{ padding: '0.25rem' }}><Plus size={14}/></button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid var(--border)', fontWeight: 600, fontSize: '1.25rem' }}>
                      <span>Total:</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between" style={{ marginTop: '2rem' }}>
                  <button className="btn btn-outline" onClick={() => setIsCartOpen(false)}>Close</button>
                  {cart.length > 0 && (
                    <button className="btn btn-primary" disabled={checkingOut} onClick={handleCheckout}>
                      {checkingOut ? 'Processing...' : user ? 'Checkout & Order' : 'Login to Checkout'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
