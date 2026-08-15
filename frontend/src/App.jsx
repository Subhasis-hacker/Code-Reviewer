import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ui/ProtectedRoute';
import Login from './pages/Public/Login';
import Register from './pages/Public/Register';
import CodeReviewer from './pages/Dashboard/CodeReviewer';
import CPDashboard from './pages/Dashboard/CPDashboard';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="reviewer" replace />} />
          <Route path="reviewer" element={<CodeReviewer />} />
          <Route path="cp-dashboard" element={<CPDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}