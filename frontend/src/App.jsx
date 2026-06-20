import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/AppLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Invoices from './pages/Invoices';
import Purchase from './pages/Purchase';
import Manufacturing from './pages/Manufacturing';
import BillOfMaterials from './pages/BillOfMaterials';
import AuditLogs from './pages/AuditLogs';
import UserManagement from './pages/UserManagement';
import StockMovements from './pages/StockMovements';
import Presentation from './pages/Presentation';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"      element={<Dashboard />} />
              <Route path="/products"       element={<Products />} />
              <Route path="/sales"          element={<Sales />} />
              <Route path="/invoices"       element={<Invoices />} />
              <Route path="/purchase"       element={<Purchase />} />
              <Route path="/manufacturing"  element={<Manufacturing />} />
              <Route path="/bom"            element={<BillOfMaterials />} />
              <Route path="/audit"          element={<AuditLogs />} />
              <Route path="/users"          element={<UserManagement />} />
              <Route path="/stock"          element={<StockMovements />} />
              <Route path="/presentation"   element={<Presentation />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
