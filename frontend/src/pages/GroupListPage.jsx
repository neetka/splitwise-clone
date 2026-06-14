import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CreateGroupModal from '../components/CreateGroupModal.jsx';
import { fetchGroups, createGroup } from '../services/groupService.js';

const GroupListPage = () => {
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

  const handleCreate = async (name) => {
    await createGroup(name);
    await loadGroups();
  };

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>Your groups</h1>
          <p>Manage your group list and add new groups here.</p>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)}>
          Create group
        </button>
      </div>

      {loading && <p>Loading groups...</p>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !groups.length && (
        <div className="empty-state">
          <p>No groups found yet.</p>
          <button type="button" onClick={() => setIsModalOpen(true)}>
            Create your first group
          </button>
        </div>
      )}

      {groups.length > 0 && (
        <div className="group-list">
          {groups.map((group) => (
            <Link key={group.id} to={`/groups/${group.id}`} className="group-card">
              <h2>{group.name}</h2>
              <p>Joined: {new Date(group.membership.joinedAt).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      )}

      <CreateGroupModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />
    </main>
  );
};

export default GroupListPage;
