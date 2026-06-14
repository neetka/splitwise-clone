import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import GroupListPage from './pages/GroupListPage.jsx';
import GroupDetailsPage from './pages/GroupDetailsPage.jsx';
import ExpenseListPage from './pages/ExpenseListPage.jsx';
import ExpenseDetailsPage from './pages/ExpenseDetailsPage.jsx';
import ExpenseFormPage from './pages/ExpenseFormPage.jsx';
import GroupBalancesPage from './pages/GroupBalancesPage.jsx';
import GlobalBalancesPage from './pages/GlobalBalancesPage.jsx';
import GroupSettlementsPage from './pages/GroupSettlementsPage.jsx';
import GlobalSettlementsPage from './pages/GlobalSettlementsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './contexts/AuthContext.jsx';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/groups" element={<GroupListPage />} />
        <Route path="/groups/:id" element={<GroupDetailsPage />} />
        <Route path="/groups/:groupId/expenses" element={<ExpenseListPage />} />
        <Route path="/groups/:groupId/expenses/new" element={<ExpenseFormPage />} />
        <Route path="/groups/:groupId/expenses/:expenseId" element={<ExpenseDetailsPage />} />
        <Route path="/groups/:groupId/expenses/:expenseId/edit" element={<ExpenseFormPage />} />
        <Route path="/groups/:groupId/balances" element={<GroupBalancesPage />} />
        <Route path="/groups/:groupId/settlements" element={<GroupSettlementsPage />} />
        <Route path="/balances" element={<GlobalBalancesPage />} />
        <Route path="/settlements" element={<GlobalSettlementsPage />} />
      </Route>
      <Route
        path="/"
        element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
