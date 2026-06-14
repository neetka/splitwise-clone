import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchGroupDetails } from '../services/groupService.js';
import { fetchGroupSettlements, createSettlement } from '../services/settlementService.js';
import SettlementList from '../components/SettlementList.jsx';
import CreateSettlementModal from '../components/CreateSettlementModal.jsx';

const GroupSettlementsPage = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupRes, settlementRes] = await Promise.all([
        fetchGroupDetails(groupId),
        fetchGroupSettlements(groupId),
      ]);
      setGroup(groupRes.data.group);
      setSettlements(settlementRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load settlements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId]);

  const payees = useMemo(() => {
    if (!group?.members) return [];
    return group.members.filter((member) => member.id !== user.id && member.isActive);
  }, [group, user.id]);

  const handleCreateSettlement = async (payload) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createSettlement({
        groupId,
        receiverId: payload.receiverId,
        amount: payload.amount,
        currency: payload.currency,
        date: payload.date,
      });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setSubmitError(err?.response?.data?.error || 'Unable to create settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="page-shell">
        <p>Loading settlement history...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <div className="error-message">{error}</div>
        <Link to={`/groups/${groupId}`}>Back to group</Link>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>{group?.name || 'Group settlements'}</h1>
          <p>Settlement history and new settlements for this group.</p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={() => setModalOpen(true)}>
            Create settlement
          </button>
          <button type="button" onClick={() => navigate(`/groups/${groupId}/balances`)}>
            View balances
          </button>
          <Link to={`/groups/${groupId}`} className="button-link">Back to group</Link>
        </div>
      </div>

      <section className="split-detail-section">
        <h2>Settlement history</h2>
        <SettlementList settlements={settlements} currentUserId={user.id} showGroup={false} />
      </section>

      {!payees.length && (
        <div className="empty-state">
          <p>No other active members to settle with.</p>
        </div>
      )}

      <CreateSettlementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        members={payees}
        defaultCurrency={group?.currency || 'INR'}
        onSubmit={handleCreateSettlement}
        submitting={submitting}
        error={submitError}
      />
    </main>
  );
};

export default GroupSettlementsPage;
