import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchMySettlements } from '../services/settlementService.js';
import SettlementList from '../components/SettlementList.jsx';

const GlobalSettlementsPage = () => {
  const { user } = useAuth();
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMySettlements();
        setSettlements(result.data || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load settlements.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>Your settlements</h1>
          <p>All settlements where you were payer or receiver.</p>
        </div>
        <div className="page-actions">
          <Link to="/dashboard" className="button-link">Home</Link>
          <Link to="/balances" className="button-link">View balances</Link>
        </div>
      </div>

      <section className="split-detail-section">
        <h2>Settlement history</h2>
        {loading ? (
          <p>Loading settlements...</p>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <SettlementList settlements={settlements} currentUserId={user.id} showGroup={true} />
        )}
      </section>

      {!loading && !error && settlements.length === 0 && (
        <div className="empty-state">
          <p>No settlements found. Use a group page to create one.</p>
        </div>
      )}
    </main>
  );
};

export default GlobalSettlementsPage;
