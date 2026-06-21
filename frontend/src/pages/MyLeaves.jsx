import { useState, useEffect } from 'react';
import { CalendarPlus, X, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

export default function MyLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const toast = useToast();

  const [leaveData, setLeaveData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: 'casual',
    customType: '',
    reason: ''
  });

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leaves/my');
      setLeaves(res.data);
    } catch (err) {
      toast.error('Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leaves/apply', leaveData);
      toast.success('Leave requested successfully!');
      setShowModal(false);
      fetchLeaves();
      setLeaveData({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        type: 'casual',
        customType: '',
        reason: ''
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply leave');
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this leave request?')) return;
    try {
      await api.delete(`/leaves/${id}/revoke`);
      toast.success('Leave revoked successfully');
      fetchLeaves();
    } catch (err) {
      toast.error('Error revoking leave');
    }
  };

  return (
    <div className="p-6 fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Leaves</h1>
          <p className="text-muted">Manage your time-off requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <CalendarPlus size={18} />
          New Leave Request
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8">Loading...</td></tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-muted">No leave requests found.</td>
                </tr>
              ) : leaves.map(leave => (
                <tr key={leave.id}>
                  <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                  <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                  <td>
                    <span className="badge" style={{ textTransform: 'capitalize' }}>
                      {leave.type === 'other' ? leave.customType : leave.type}
                    </span>
                  </td>
                  <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {leave.reason || '-'}
                  </td>
                  <td>
                    <span className={`badge ${
                      leave.status === 'approved' ? 'bg-success' : 
                      leave.status === 'rejected' ? 'bg-danger' : 'bg-warning'
                    }`}>
                      {leave.status}
                    </span>
                  </td>
                  <td className="text-right">
                    {(leave.status === 'pending' || leave.status === 'approved') && (
                      <button 
                        className="icon-btn" 
                        style={{ color: 'var(--danger)' }}
                        onClick={() => handleRevoke(leave.id)}
                        title="Revoke Leave"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h2 className="modal-title"><CalendarPlus size={20} style={{ marginRight: 8 }}/> Apply for Leave</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleApply} style={{ padding: 20 }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" required value={leaveData.startDate} onChange={e => setLeaveData({...leaveData, startDate: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" required value={leaveData.endDate} onChange={e => setLeaveData({...leaveData, endDate: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Leave Type</label>
                <select className="form-select" value={leaveData.type} onChange={e => setLeaveData({...leaveData, type: e.target.value})}>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="half_day">Half Day</option>
                  <option value="other">Other (Specify)</option>
                </select>
              </div>
              {leaveData.type === 'other' && (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Custom Type</label>
                  <input type="text" className="form-input" required placeholder="E.g., Maternity, Bereavement" value={leaveData.customType} onChange={e => setLeaveData({...leaveData, customType: e.target.value})} />
                </div>
              )}
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Reason</label>
                <textarea className="form-input" rows="3" required value={leaveData.reason} onChange={e => setLeaveData({...leaveData, reason: e.target.value})} placeholder="Brief reason for leave..." />
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
