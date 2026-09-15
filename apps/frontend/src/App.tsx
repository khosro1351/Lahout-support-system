import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { LoginPage } from './pages/LoginPage';
import { GuidePage } from './pages/GuidePage';
import { AccessRequestsPage } from './pages/AccessRequestsPage';
import { AccessRequestDetailPage } from './pages/AccessRequestDetailPage';
import './style.css';
export default function App() {
 const { user, loading } = useAuth();
 if (loading) return <main className="loading" role="status">در حال بررسی نشست…</main>;
 const guide = user?.roles.some(r => r.roleCode === 'SUPREME_GUIDE' && r.scopeType === 'ORGANIZATION' && r.scopeId === null);
 return <Routes><Route path="/login" element={guide ? <Navigate to="/guide" replace /> : <LoginPage />} /><Route path="/guide" element={guide ? <GuidePage /> : <Navigate to="/login" replace />} /><Route path="/guide/access-requests" element={guide ? <AccessRequestsPage /> : <Navigate to="/login" replace />} /><Route path="/guide/access-requests/:id" element={guide ? <AccessRequestDetailPage /> : <Navigate to="/login" replace />} /><Route path="*" element={<Navigate to={guide ? '/guide' : '/login'} replace />} /></Routes>;
}
