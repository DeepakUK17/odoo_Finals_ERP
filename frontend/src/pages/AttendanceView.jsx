import { useState, useEffect } from 'react';
import { Download, Calendar, Search, Users } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

export default function AttendanceView() {
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'monthly'
  
  // Daily State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailySheet, setDailySheet] = useState([]);
  
  // Monthly State
  const [monthStr, setMonthStr] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [monthlyReport, setMonthlyReport] = useState([]);

  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (activeTab === 'daily') fetchDailySheet();
    else fetchMonthlyReport();
  }, [date, monthStr, activeTab]);

  const fetchDailySheet = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/daily?date=${date}`);
      setDailySheet(res.data);
    } catch (error) {
      toast.error('Failed to fetch daily sheet');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const [year, month] = monthStr.split('-');
      const res = await api.get(`/attendance/monthly?month=${month}&year=${year}`);
      setMonthlyReport(res.data);
    } catch (error) {
      toast.error('Failed to fetch monthly report');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (userId, status) => {
    try {
      await api.put('/attendance/daily', { userId, date, status });
      setDailySheet(prev => prev.map(row => row.user.id === userId ? { ...row, status } : row));
      toast.success(`Marked ${status}`);
    } catch (error) {
      toast.error('Failed to update attendance');
    }
  };

  const handleExportMonthly = () => {
    const [year, month] = monthStr.split('-');
    window.open(`http://localhost:5000/api/attendance/export?month=${month}&year=${year}&token=${localStorage.getItem('erp_token')}`);
  };

  return (
    <div className="p-6 fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance Tracker</h1>
          <p className="text-muted">Manage daily and monthly attendance records</p>
        </div>

        <div className="flex gap-4 items-center">
          {activeTab === 'daily' ? (
            <div className="form-group mb-0">
              <input 
                type="date" 
                className="form-input" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="form-group mb-0">
              <input 
                type="month" 
                className="form-input" 
                value={monthStr} 
                onChange={(e) => setMonthStr(e.target.value)}
              />
            </div>
          )}
          <button className="btn btn-primary" onClick={handleExportMonthly}>
            <Download size={18} />
            Export Monthly CSV
          </button>
        </div>
      </div>

      <div className="tabs mb-6" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
          style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: activeTab === 'daily' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'daily' ? '2px solid var(--primary)' : 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Daily Marking
        </button>
        <button 
          className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
          style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: activeTab === 'monthly' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'monthly' ? '2px solid var(--primary)' : 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Monthly Report
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          {activeTab === 'daily' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Mark Attendance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-8">Loading sheet...</td></tr>
                ) : dailySheet.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-muted">No active employees found.</td>
                  </tr>
                ) : dailySheet.map(row => (
                  <tr key={row.user.id}>
                    <td>
                      <div className="font-medium">{row.user.name}</div>
                      <div className="text-sm text-muted">{row.user.email}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${row.user.role.toLowerCase()}`}>
                        {row.user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        row.status === 'present' ? 'bg-success' : 
                        row.status === 'absent' ? 'bg-danger' : 
                        row.status === 'leave' ? 'bg-info' : 
                        row.status === 'half_day' ? 'bg-warning' : ''
                      }`}>
                        {row.status || 'Not Marked'}
                      </span>
                    </td>
                    <td className="text-right">
                      <select 
                        className="form-select" 
                        style={{ width: '150px', display: 'inline-block' }}
                        value={row.status || ''}
                        onChange={(e) => updateStatus(row.user.id, e.target.value)}
                      >
                        <option value="" disabled>Select Status...</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="half_day">Half Day</option>
                        <option value="leave">On Leave</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="text-center">Total Present</th>
                  <th className="text-center">Total Absent</th>
                  <th className="text-center">Total Leaves</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center py-8">Loading report...</td></tr>
                ) : monthlyReport.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-muted">No data found for this month.</td>
                  </tr>
                ) : monthlyReport.map(row => (
                  <tr key={row.userId}>
                    <td>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-sm text-muted">{row.email}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${row.role.toLowerCase()}`}>
                        {row.role}
                      </span>
                    </td>
                    <td className="text-center font-bold text-success">{row.totalPresent}</td>
                    <td className="text-center font-bold text-danger">{row.totalAbsent}</td>
                    <td className="text-center font-bold text-info">{row.totalLeaves}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
