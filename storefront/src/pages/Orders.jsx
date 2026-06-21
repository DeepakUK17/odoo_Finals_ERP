import { useState, useEffect, useCallback } from 'react';
import { Package } from 'lucide-react';
import api from '../api';
import socket from '../socket';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const handleDataUpdated = () => {
      fetchOrders();
    };

    socket.on('data_updated', handleDataUpdated);
    return () => socket.off('data_updated', handleDataUpdated);
  }, [fetchOrders]);

  const getStatusText = (order) => {
    if (order.status === 'draft') return 'Order Placed (Pending Confirmation)';
    if (order.status === 'confirmed') return 'Order Accepted & Processing';
    if (order.status === 'cancelled') return 'Cancelled';
    
    // Check item delivery statuses
    const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
    const deliveredItems = order.items.reduce((s, i) => s + i.deliveredQty, 0);

    if (deliveredItems >= totalItems) return 'Completely Shipped';
    if (deliveredItems > 0) return `Partially Shipped (${deliveredItems} of ${totalItems} shipped)`;
    return 'Confirmed & Awaiting Shipment';
  };

  const getStatusColor = (statusText) => {
    if (statusText.includes('Pending')) return '#f59e0b'; // amber
    if (statusText.includes('Accepted') || statusText.includes('Confirmed')) return '#3b82f6'; // blue
    if (statusText.includes('Completely')) return '#10b981'; // green
    if (statusText.includes('Partially')) return '#8b5cf6'; // purple
    if (statusText === 'Cancelled') return '#ef4444'; // red
    return '#6b7280';
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading your orders...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '2rem' }}>My Orders</h2>
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Package size={48} opacity={0.2} style={{ margin: '0 auto 1rem auto' }} />
          <p>You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {orders.map(order => {
            const statusText = getStatusText(order);
            const statusColor = getStatusColor(statusText);
            
            return (
              <div key={order.id} className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{order.orderNo}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      display: 'inline-block', 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '999px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600, 
                      backgroundColor: `${statusColor}22`,
                      color: statusColor,
                      marginBottom: '0.5rem'
                    }}>
                      {statusText}
                    </span>
                    <div style={{ fontWeight: 600 }}>Total: ${order.totalAmount.toFixed(2)}</div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</h4>
                  {order.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{item.qty}x</span> {item.product.name}
                        {item.deliveredQty > 0 && item.deliveredQty < item.qty && (
                          <span style={{ color: '#8b5cf6', marginLeft: '0.5rem' }}>({item.deliveredQty} shipped)</span>
                        )}
                        {item.deliveredQty >= item.qty && (
                          <span style={{ color: '#10b981', marginLeft: '0.5rem' }}>(shipped)</span>
                        )}
                      </div>
                      <div>${item.totalPrice.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
