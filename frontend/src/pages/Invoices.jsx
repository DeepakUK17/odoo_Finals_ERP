import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { FileText, DollarSign, CheckCircle, CreditCard, Printer, X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function Invoices() {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data } = await api.get('/invoices');
      setInvoices(data.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadInvoiceDetails = async (id) => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      setSelectedInvoice(data.data);
      setPaymentAmount((data.data.netAmount - data.data.amountPaid).toFixed(2));
    } catch (err) { toast.error('Failed to load invoice'); }
  };

  const handlePayment = async () => {
    setSaving(true);
    try {
      await api.post(`/invoices/${selectedInvoice.id}/payment`, {
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: `PAY-${Date.now()}`
      });
      toast.success('Payment recorded successfully');
      loadInvoiceDetails(selectedInvoice.id);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    }
    setSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      <div className="page-header print-hide">
        <div>
          <h1 className="page-title">Invoices & Payments</h1>
          <p className="page-subtitle">Manage customer invoices, track partial payments, and print bills.</p>
        </div>
      </div>

      <div className="content-grid print-hide" style={{ gridTemplateColumns: selectedInvoice ? '1fr 400px' : '1fr' }}>
        
        {/* Invoices List */}
        <div className="card">
          <div className="table-container">
            {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Sales Order</th>
                    <th>Customer</th>
                    <th>Net Amount</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No invoices found</td></tr>
                  ) : invoices.map(inv => {
                    const balance = inv.netAmount - inv.amountPaid;
                    return (
                      <tr key={inv.id} className={selectedInvoice?.id === inv.id ? 'active-row' : ''} onClick={() => loadInvoiceDetails(inv.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 600 }}>{inv.invoiceNo}</td>
                        <td><span className="badge badge-info">{inv.salesOrder.orderNo}</span></td>
                        <td>{inv.customer}</td>
                        <td>₹{inv.netAmount.toLocaleString('en-IN')}</td>
                        <td style={{ color: balance > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          ₹{balance.toLocaleString('en-IN')}
                        </td>
                        <td><span className={`badge badge-${inv.status}`}>{inv.status.replace('_', ' ')}</span></td>
                        <td>
                          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); loadInvoiceDetails(inv.id); }}><FileText size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Invoice Detail Panel */}
        {selectedInvoice && (
          <div className="card animate-slide-in" style={{ position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Invoice {selectedInvoice.invoiceNo}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-icon" onClick={handlePrint} title="Print Invoice"><Printer size={18} /></button>
                <button className="btn-icon" onClick={() => setSelectedInvoice(null)}><X size={18} /></button>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-row"><span className="label">Status</span><span className={`badge badge-${selectedInvoice.status}`}>{selectedInvoice.status.replace('_', ' ')}</span></div>
              <div className="detail-row"><span className="label">Customer</span><span className="value">{selectedInvoice.customer}</span></div>
              <div className="detail-row"><span className="label">Sales Order</span><span className="badge badge-info">{selectedInvoice.salesOrder.orderNo}</span></div>
              <div className="detail-row"><span className="label">Issued On</span><span className="value">{new Date(selectedInvoice.issuedAt).toLocaleDateString()}</span></div>
              <div className="detail-row"><span className="label">Due Date</span><span className="value">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span></div>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 12 }}>Financial Summary</h3>
            <div className="detail-section bg-gray-900/50 p-4 rounded-xl border border-gray-800">
              <div className="detail-row"><span className="label">Subtotal</span><span className="value">₹{selectedInvoice.totalAmount.toLocaleString('en-IN')}</span></div>
              <div className="detail-row"><span className="label">Tax (18% GST)</span><span className="value text-gray-400">₹{selectedInvoice.taxAmount.toLocaleString('en-IN')}</span></div>
              <div className="detail-row mt-2 pt-2 border-t border-gray-800"><span className="label text-white font-bold">Net Total</span><span className="value text-white font-bold text-lg">₹{selectedInvoice.netAmount.toLocaleString('en-IN')}</span></div>
              
              <div className="detail-row mt-4"><span className="label">Amount Paid</span><span className="value text-success">₹{selectedInvoice.amountPaid.toLocaleString('en-IN')}</span></div>
              <div className="detail-row"><span className="label text-warning font-bold">Balance Due</span><span className="value text-warning font-bold text-lg">₹{(selectedInvoice.netAmount - selectedInvoice.amountPaid).toLocaleString('en-IN')}</span></div>
            </div>

            {selectedInvoice.status !== 'paid' && (
              <div className="mt-6 p-4 rounded-xl border border-primary/30 bg-primary/5">
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center"><DollarSign size={16} className="mr-1"/> Record Payment</h3>
                <div className="space-y-3">
                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" className="input" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} max={selectedInvoice.netAmount - selectedInvoice.amountPaid} />
                  </div>
                  <div className="form-group">
                    <label>Method</label>
                    <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                      <option>Bank Transfer</option>
                      <option>UPI</option>
                      <option>Cash</option>
                      <option>Credit Card</option>
                    </select>
                  </div>
                  <button className="btn btn-primary w-full justify-center" onClick={handlePayment} disabled={saving || !paymentAmount || paymentAmount <= 0}>
                    <CreditCard size={16} /> Process Payment
                  </button>
                </div>
              </div>
            )}

            {selectedInvoice.payments?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3">Payment History</h3>
                <div className="space-y-2">
                  {selectedInvoice.payments.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30 border border-gray-700/50 text-sm">
                      <div>
                        <div className="font-medium text-white">₹{p.amount.toLocaleString('en-IN')}</div>
                        <div className="text-gray-400 text-xs">{p.method} • {p.reference}</div>
                      </div>
                      <div className="text-gray-500 text-xs">{new Date(p.paymentDate).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Print View */}
      {selectedInvoice && (
        <div className="print-only">
          <div className="print-header">
            <div className="print-brand">
              <h1>Shiv Furniture Works</h1>
              <p>123 Industrial Estate, Phase 1</p>
              <p>GSTIN: 27AABCT3421C1Z4</p>
            </div>
            <div className="print-meta text-right">
              <h2>TAX INVOICE</h2>
              <p><strong>Invoice No:</strong> {selectedInvoice.invoiceNo}</p>
              <p><strong>Date:</strong> {new Date(selectedInvoice.issuedAt).toLocaleDateString()}</p>
              <p><strong>Sales Order:</strong> {selectedInvoice.salesOrder.orderNo}</p>
            </div>
          </div>

          <div className="print-customer" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>Billed To:</h3>
            <p><strong>{selectedInvoice.customer}</strong></p>
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.salesOrder.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.product.name}</td>
                  <td>{item.qty}</td>
                  <td>₹{item.unitPrice.toLocaleString('en-IN')}</td>
                  <td>₹{item.totalPrice.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-totals" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span>Subtotal:</span>
                <span>₹{selectedInvoice.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span>CGST (9%):</span>
                <span>₹{(selectedInvoice.taxAmount / 2).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '2px solid #000' }}>
                <span>SGST (9%):</span>
                <span>₹{(selectedInvoice.taxAmount / 2).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', fontWeight: 'bold', fontSize: '1.2rem' }}>
                <span>Net Total:</span>
                <span>₹{selectedInvoice.netAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', color: '#666' }}>
                <span>Amount Paid:</span>
                <span>₹{selectedInvoice.amountPaid.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 'bold' }}>
                <span>Balance Due:</span>
                <span>₹{(selectedInvoice.netAmount - selectedInvoice.amountPaid).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '4rem', borderTop: '1px solid #ccc', paddingTop: '1rem', textAlign: 'center', fontSize: '12px', color: '#666' }}>
            <p>Thank you for your business!</p>
            <p>Subject to local jurisdiction. Goods once sold will not be taken back.</p>
          </div>
        </div>
      )}
    </div>
  );
}
