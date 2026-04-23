import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Onboarding from './routes/Onboarding';
import ListRoute from './routes/List';
import EditItem from './routes/EditItem';
import ManageMarkets from './routes/ManageMarkets';
import Settings from './routes/Settings';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { uid, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">加载中…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-danger text-sm text-center">{error}</div>
      </div>
    );
  }
  if (!uid) return null;

  return (
    <div className="mx-auto max-w-mobile min-h-screen">
      <Routes>
        <Route path="/" element={<FirstOpenRedirect />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/list" element={<ListRoute />} />
        <Route path="/edit-item/:id" element={<EditItem />} />
        <Route path="/manage-markets" element={<ManageMarkets />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/list" replace />} />
      </Routes>
    </div>
  );
}

function FirstOpenRedirect() {
  const [params] = useSearchParams();
  const listId = params.get('list');
  const seen = localStorage.getItem('maisha:seen') === '1';

  if (listId) {
    return <Navigate to={`/list?list=${listId}`} replace />;
  }
  if (!seen) {
    localStorage.setItem('maisha:seen', '1');
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to="/list" replace />;
}
