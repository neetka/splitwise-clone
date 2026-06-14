import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteExpense, fetchExpense } from '../services/expenseService.js';
import { fetchGroupDetails } from '../services/groupService.js';

const ExpenseDetailsPage = () => {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const loadExpense = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expenseRes, groupRes] = await Promise.all([
        fetchExpense(expenseId),
        fetchGroupDetails(groupId),
      ]);
      setExpense(expenseRes.data);
      setGroupMembers(groupRes.data.group.members || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Unable to load expense details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpense();
  }, [expenseId]);

  const handleDelete = async () => {
    setDeleteError(null);
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    try {
      await deleteExpense(expenseId);
      navigate(`/groups/${groupId}/expenses`);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || 'Unable to delete expense.');
    }
  };

  const getMemberName = (userId) => {
    const member = groupMembers.find((item) => item.id === userId);
    return member?.name || userId;
  };

  if (loading) {
    return (
      <main className="page-shell">
        <p>Loading expense...</p>
      </main>
    );
  }

  if (error || !expense) {
    return (
      <main className="page-shell">
        <div className="error-message">{error || 'Expense not found.'}</div>
        <Link to={`/groups/${groupId}/expenses`}>Back to expenses</Link>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>{expense.title}</h1>
          <p>{expense.group?.name || 'Expense details'}</p>
        </div>
        <div className="page-actions">
          <Link to={`/groups/${groupId}/expenses/${expenseId}/edit`}>Edit expense</Link>
          <button type="button" className="danger-button" onClick={handleDelete}>
            Delete expense
          </button>
          <Link to={`/groups/${groupId}/expenses`}>Back to expenses</Link>
        </div>
      </div>

      <section className="detail-card">
        <div>
          <strong>Date</strong>
          <span>{new Date(expense.date).toLocaleDateString()}</span>
        </div>
        <div>
          <strong>Paid by</strong>
          <span>{expense.paidByUser?.name || expense.paidByUser?.email}</span>
        </div>
        <div>
          <strong>Total</strong>
          <span>{expense.currency} {expense.totalAmount.toFixed(2)}</span>
        </div>
        <div>
          <strong>Split type</strong>
          <span>{expense.splitType}</span>
        </div>
        {expense.description && (
          <div>
            <strong>Description</strong>
            <span>{expense.description}</span>
          </div>
        )}
      </section>

      <section className="split-preview-section">
        <h2>Split breakdown</h2>
        <table className="expense-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Amount</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {expense.splits.map((split) => (
              <tr key={split.userId}>
                <td>{getMemberName(split.userId)}{split.userId === expense.paidByUser?.id ? ' (payer)' : ''}</td>
                <td>{expense.currency} {split.amount.toFixed(2)}</td>
                <td>
                  {split.splitType === 'UNEQUAL' ? 'Amount' : split.splitType === 'PERCENTAGE' ? `${split.splitValue}%` : split.splitType === 'SHARE' ? `Share ${split.splitValue}` : 'Equal'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {deleteError && <div className="error-message">{deleteError}</div>}
    </main>
  );
};

export default ExpenseDetailsPage;
