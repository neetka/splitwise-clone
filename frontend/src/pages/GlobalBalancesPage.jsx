import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchGlobalBalances } from '../services/balanceService.js';

const GlobalBalancesPage = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchGlobalBalances();
        setBalances(result.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load balances.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const hasBalances = balances?.peerBalances?.length > 0;

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>Your balances</h1>
          <p>Net balances across all groups.</p>
        </div>
        <div className="page-actions">
          <Link to="/dashboard" className="button-link">Home</Link>
          <Link to="/settlements" className="button-link">View settlements</Link>
        </div>
      </div>

      <section className="balance-summary-card">
        <div>
          <strong>You owe</strong>
          <span>{balances ? ` ${balances.totalOwed.toFixed(2)}` : '0.00'}</span>
        </div>
        <div>
          <strong>You are owed</strong>
          <span>{balances ? ` ${balances.totalOwedToMe.toFixed(2)}` : '0.00'}</span>
        </div>
        <div>
          <strong>Status</strong>
          <span>{hasBalances ? 'Outstanding balances' : 'Settled up'}</span>
        </div>
      </section>

      <section className="split-detail-section">
        <h2>Peer balances</h2>
        {loading ? (
          <p>Loading balances...</p>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : !hasBalances ? (
          <div className="empty-state">
            <p>You have no outstanding balances across your groups.</p>
          </div>
        ) : (
          <table className="expense-table">
            <thead>
              <tr>
                <th>Direction</th>
                <th>Other user</th>
                <th>Amount</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {balances.peerBalances.map((balance) => {
                const isYouOwe = balance.debtorId === user.id;
                const otherUser = isYouOwe ? balance.creditorId : balance.debtorId;
                const direction = isYouOwe ? 'You owe' : 'You are owed';
                return (
                  <tr key={`${balance.groupId}-${balance.debtorId}-${balance.creditorId}`}>
                    <td>{direction}</td>
                    <td>{otherUser}</td>
                    <td>{balance.amount.toFixed(2)}</td>
                    <td>{balance.groupId}</td>
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

export default GlobalBalancesPage;
