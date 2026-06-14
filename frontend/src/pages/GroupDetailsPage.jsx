import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchGroupDetails, addGroupMember, removeGroupMember } from '../services/groupService.js';

const GroupDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberEmail, setMemberEmail] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchGroupDetails(id);
      setGroup(result.data.group);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load group details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroup();
  }, [id]);

  const currentMembership = useMemo(() => {
    if (!group || !user) return null;
    return group.members.find((member) => member.id === user.id);
  }, [group, user]);

  const canManageMembers = currentMembership?.isAdmin;

  const handleAddMember = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await addGroupMember(id, memberEmail.trim());
      setSuccess('Member added successfully.');
      setMemberEmail('');
      await loadGroup();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to add member.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    setError(null);
    setSuccess(null);
    try {
      await removeGroupMember(id, memberId);
      setSuccess('Member removed successfully.');
      await loadGroup();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to remove member.');
    }
  };

  if (loading) {
    return (
      <main className="page-shell">
        <p>Loading group details...</p>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="page-shell">
        <p>Group not found.</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>{group.name}</h1>
          <p>Group ID: {group.id}</p>
        </div>
        <Link to="/groups">Back to groups</Link>
      </div>

      <section className="group-summary-card">
        <div>
          <strong>Created</strong>
          <span>{new Date(group.createdAt).toLocaleDateString()}</span>
        </div>
        <div>
          <strong>Updated</strong>
          <span>{new Date(group.updatedAt).toLocaleDateString()}</span>
        </div>
        <div>
          <strong>Members</strong>
          <span>{group.members.length}</span>
        </div>
      </section>

      <section className="group-actions-card">
        <Link to={`/groups/${group.id}/expenses`} className="button-link">
          View group expenses
        </Link>
        <Link to={`/groups/${group.id}/balances`} className="button-link">
          View balances
        </Link>
        <Link to={`/groups/${group.id}/settlements`} className="button-link">
          View settlements
        </Link>
      </section>

      <section className="members-section">
        <div className="members-header">
          <h2>Members</h2>
          <p>{group.members.length} total members</p>
        </div>

        <div className="member-actions">
          {canManageMembers ? (
            <form onSubmit={handleAddMember} className="member-form">
              <label>
                Add member by email
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="member@example.com"
                  required
                />
              </label>
              <button type="submit">Add member</button>
            </form>
          ) : (
            <p>You must be a group admin to add or remove members.</p>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <table className="member-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {group.members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.email}</td>
                <td>{member.isActive ? 'Active' : 'Removed'}</td>
                <td>{member.isAdmin ? 'Admin' : 'Member'}</td>
                <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
                <td>
                  {canManageMembers && member.isActive && member.id !== user.id ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      Remove
                    </button>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
};

export default GroupDetailsPage;
