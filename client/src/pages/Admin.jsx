import { Route, Routes } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AdminOrders from './AdminOrders.jsx';
import AdminEmployees from './AdminEmployees.jsx';

const NAV = [
  { to: '/admin', label: 'Task List', end: true },
  { to: '/admin/orders', label: 'Order List' },
  { to: '/admin/employees', label: 'Employee List' },
];

export default function Admin() {
  return (
    <Shell nav={NAV}>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="employees" element={<AdminEmployees />} />
      </Routes>
    </Shell>
  );
}
