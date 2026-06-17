import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Onboarding from './routes/Onboarding';
import ListRoute from './routes/List';
import EditItem from './routes/EditItem';
import ManageStores from './routes/ManageStores';
import Settings from './routes/Settings';
import IconPreview from './routes/IconPreview';
import IconLibrary from './routes/IconLibrary';
import ShoppingMode from '@/routes/ShoppingMode';
import PurchaseHistory from '@/routes/PurchaseHistory';
import PurchaseHistoryDetail from '@/routes/PurchaseHistoryDetail';
import JoinByCode from '@/routes/JoinByCode';
import Privacy from '@/routes/Privacy';
import MyLists from './routes/MyLists';
import AllLists from './routes/AllLists';
import StoreFinder from './routes/StoreFinder';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAuth } from './hooks/useAuth';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/icon-preview" element={<IconPreview />} />
        <Route path="*" element={<AuthedApp />} />
      </Routes>
      <UpdatePrompt />
    </>
  );
}

function AuthedApp() {
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
  if (!uid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-center" style={{ color: '#a0937e' }}>
          连接失败，请检查网络后刷新页面
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-mobile min-h-screen">
      <Routes>
        <Route path="/" element={<FirstOpenRedirect />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/list" element={<ListRoute />} />
        <Route path="/edit-item/:id" element={<EditItem />} />
        <Route path="/manage-stores" element={<ManageStores />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/icons" element={<IconLibrary />} />
        <Route path="/shopping/:marketId" element={<ShoppingMode />} />
        <Route path="/history" element={<PurchaseHistory />} />
        <Route path="/history/:id" element={<PurchaseHistoryDetail />} />
        <Route path="/join" element={<JoinByCode />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/my-lists" element={<MyLists />} />
        <Route path="/all-lists" element={<AllLists />} />
        <Route path="/store-finder" element={<StoreFinder />} />
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
