import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

export default function LeaveApprovals() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.get('/leaves/all');
      setLeaves(res.data);
    } catch (error) {
      toast.error('Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/leaves/${id}/status`, { status });
      toast.success(`Leave request ${status}`);
      fetchLeaves();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (loading) return <div className="p-6">Loading leaves...</div>;

  return (
    <div className="p-6 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Leave Approvals</h1>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dates</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-muted">No leave requests found.</td>
                </tr>
              ) : leaves.map(leave => (
                <tr key={leave.id}>
                  <td>
                    <div className="font-medium">{leave.user.name}</div>
                    <div className="text-sm text-muted">{leave.user.email}</div>
                  </td>
                  <td>
                    {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                  </td>
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
                    {leave.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <button 
                          className="icon-btn" 
                          style={{ color: 'var(--success)' }}
                          onClick={() => handleStatusChange(leave.id, 'approved')}
                          title="Approve"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button 
                          className="icon-btn" 
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleStatusChange(leave.id, 'rejected')}
                          title="Reject"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
