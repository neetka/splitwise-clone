import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchGroupBalances } from '../services/balanceService.js';
import { fetchGroupDetails } from '../services/groupService.js';

const GroupBalancesPage = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [groupRes, balanceRes] = await Promise.all([
          fetchGroupDetails(groupId),
          fetchGroupBalances(groupId),
        ]);
        setGroup(groupRes.data.group);
        setBalances(balanceRes.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load balances.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [groupId]);

  const memberMap = useMemo(() => {
    if (!group?.members) return {};
    return group.members.reduce((map, member) => {
      map[member.id] = member.name || member.email;
      return map;
    }, {});
  }, [group]);

  const currentSummary = useMemo(() => {
    if (!balances?.groupBalances) return { totalOwed: 0, totalOwedToMe: 0 };
    return balances.groupBalances.find((item) => item.userId === user.id) || { totalOwed: 0, totalOwedToMe: 0 };
  }, [balances, user.id]);

  const hasBalances = balances?.peerBalances?.length > 0;

  if (loading) {
    return (
      <main className="page-shell">
        <p>Loading group balances...</p>
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
          <h1>{group?.name || 'Group balances'}</h1>
          <p>Peer-to-peer balances for this group.</p>
        </div>
        <div className="page-actions">
          <Link to={`/groups/${groupId}`} className="button-link">Back to group</Link>
          <Link to={`/groups/${groupId}/settlements`} className="button-link">View settlements</Link>
        </div>
      </div>

      <section className="balance-summary-card">
        <div>
          <strong>You owe</strong>
          <span>{group?.currency || ''} {currentSummary.totalOwed?.toFixed(2)}</span>
        </div>
        <div>
          <strong>You are owed</strong>
          <span>{group?.currency || ''} {currentSummary.totalOwedToMe?.toFixed(2)}</span>
        </div>
        <div>
          <strong>Status</strong>
          <span>{hasBalances ? 'Outstanding balances' : 'Settled up'}</span>
        </div>
      </section>

      <section className="split-detail-section">
        <h2>Peer balances</h2>
        {!hasBalances ? (
          <div className="empty-state">
            <p>No outstanding balances in this group. Everything is settled up.</p>
          </div>
        ) : (
          <table className="expense-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {balances.peerBalances.map((balance) => {
                const isYouOwe = balance.debtorId === user.id;
                const label = isYouOwe
                  ? `You owe ${memberMap[balance.creditorId] || balance.creditorId}`
                  : `${memberMap[balance.debtorId] || balance.debtorId} owes you`;

                return (
                  <tr key={`${balance.debtorId}-${balance.creditorId}`}>
                    <td>{memberMap[isYouOwe ? balance.creditorId : balance.debtorId] || (isYouOwe ? balance.creditorId : balance.debtorId)}</td>
                    <td>{label}</td>
                    <td>{group?.currency || ''} {Number(balance.amount).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
};

export default GroupBalancesPage;
