import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CreateGroupModal from '../components/CreateGroupModal.jsx';
import { fetchGroups, createGroup } from '../services/groupService.js';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchGroups();
      setGroups(result.data.groups || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreate = async (name) => {
    await createGroup(name);
    await loadGroups();
  };

  return (
    <main className="page-shell dashboard-shell">
      <div className="dashboard-card">
        <div className="page-header">
          <div>
            <h1>Welcome back, {user?.name || 'user'}!</h1>
            <p>Start by managing your groups and inviting members.</p>
          </div>
          <div className="dashboard-actions">
            <button type="button" onClick={() => setIsModalOpen(true)}>
              Create group
            </button>
            <button type="button" onClick={() => navigate('/groups')}>
              View all groups
            </button>
            <button type="button" onClick={() => navigate('/balances')}>
              View balances
            </button>
            <button type="button" onClick={() => navigate('/settlements')}>
              View settlements
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <section className="group-preview">
          <h2>Your groups</h2>
          {loading && <p>Loading groups...</p>}
          {!loading && groups.length === 0 && (
            <p>No groups yet. Create one to get started.</p>
          )}
          {!loading && groups.length > 0 && (
            <div className="group-list preview-list">
              {groups.slice(0, 4).map((group) => (
                <Link key={group.id} to={`/groups/${group.id}`} className="group-card">
                  <h3>{group.name}</h3>
                  <p>Joined: {new Date(group.membership.joinedAt).toLocaleDateString()}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <button type="button" onClick={handleLogout} className="logout-button">
          Sign out
        </button>
      </div>

      <CreateGroupModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />
    </main>
  );
};

export default DashboardPage;
