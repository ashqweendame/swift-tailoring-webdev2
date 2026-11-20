import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Track from './pages/Track.jsx';
import Login from './pages/Login.jsx';
import Service from './pages/Service.jsx';
import Tailor from './pages/Tailor.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Track />} />
      <Route path="/login" element={<Login />} />
      <Route path="/service" element={<ProtectedRoute role="service"><Service /></ProtectedRoute>} />
      <Route path="/tailor" element={<ProtectedRoute role="tailor"><Tailor /></ProtectedRoute>} />
      <Route path="/admin/*" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
