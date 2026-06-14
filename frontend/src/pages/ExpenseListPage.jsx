import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchGroupDetails } from '../services/groupService.js';
import { fetchGroupExpenses } from '../services/expenseService.js';

const ExpenseListPage = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupRes, expensesRes] = await Promise.all([
        fetchGroupDetails(groupId),
        fetchGroupExpenses(groupId),
      ]);
      setGroup(groupRes.data.group);
      setExpenses(expensesRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId]);

  const activeMemberCount = useMemo(() => {
    return group?.members?.filter((member) => member.isActive).length || 0;
  }, [group]);

  if (loading) {
    return (
      <main className="page-shell">
        <p>Loading expenses...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <div className="error-message">{error}</div>
        <button type="button" onClick={loadData}>Retry</button>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>{group?.name || 'Group expenses'}</h1>
          <p>{activeMemberCount} active members</p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={() => navigate(`/groups/${groupId}/expenses/new`)}>
            Add expense
          </button>
          <Link to={`/groups/${groupId}`}>Back to group</Link>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state">
          <p>No expenses recorded yet.</p>
          <button type="button" onClick={() => navigate(`/groups/${groupId}/expenses/new`)}>
            Create first expense
          </button>
        </div>
      ) : (
        <table className="expense-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Paid by</th>
              <th>Split type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.title}</td>
                <td>{new Date(expense.date).toLocaleDateString()}</td>
                <td>{expense.currency} {expense.totalAmount.toFixed(2)}</td>
                <td>{expense.paidByUser?.name || 'Unknown'}</td>
                <td>{expense.splitType}</td>
                <td>
                  <Link to={`/groups/${groupId}/expenses/${expense.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};

export default ExpenseListPage;
