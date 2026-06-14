import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <main className="page-shell dashboard-shell">
      <div className="dashboard-card">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name || 'user'}!</p>
        <p>Your email is {user?.email}</p>
        <button type="button" onClick={handleLogout} className="logout-button">
          Sign out
        </button>
      </div>
    </main>
  );
};

export default DashboardPage;
