import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchGroupDetails } from '../services/groupService.js';
import { createExpense, fetchExpense, updateExpense } from '../services/expenseService.js';
import { buildPayloadFromForm, calculateExpensePreview } from '../utils/expenseUtils.js';

const splitOptions = [
  { value: 'EQUAL', label: 'Equal' },
  { value: 'UNEQUAL', label: 'Unequal' },
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'SHARE', label: 'Share' },
];

const ExpenseFormPage = () => {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(expenseId);
  const [group, setGroup] = useState(null);
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [date, setDate] = useState('');
  const [paidByUserId, setPaidByUserId] = useState('');
  const [splitType, setSplitType] = useState('EQUAL');
  const [splits, setSplits] = useState([]);

  const activeMembers = useMemo(() => {
    return group?.members?.filter((member) => member.isActive) || [];
  }, [group]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const groupRes = await fetchGroupDetails(groupId);
        setGroup(groupRes.data.group);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load group data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [groupId]);

  useEffect(() => {
    if (!isEdit || !group) return;
    const loadExpense = async () => {
      setLoading(true);
      setError(null);
      try {
        const expenseRes = await fetchExpense(expenseId);
        const exp = expenseRes.data;
        setExpense(exp);
        setTitle(exp.title);
        setDescription(exp.description || '');
        setTotalAmount(exp.totalAmount.toString());
        setCurrency(exp.currency || 'INR');
        setDate(new Date(exp.date).toISOString().slice(0, 10));
        setPaidByUserId(exp.paidByUser?.id || '');
        setSplitType(exp.splitType);
        setSplits(activeMembers.map((member) => {
          const existingSplit = exp.splits.find((split) => split.userId === member.id);
          return {
            userId: member.id,
            name: member.name,
            email: member.email,
            amount: existingSplit?.amount ?? 0,
            splitValue: existingSplit?.splitValue ?? 0,
          };
        }));
      } catch (err) {
        setError(err?.response?.data?.error || 'Unable to load expense details.');
      } finally {
        setLoading(false);
      }
    };

    loadExpense();
  }, [expenseId, group, isEdit, activeMembers]);

  useEffect(() => {
    if (!group || isEdit) return;
    setPaidByUserId(group.members?.[0]?.id || '');
    setSplits(activeMembers.map((member) => ({
      userId: member.id,
      name: member.name,
      email: member.email,
      amount: 0,
      splitValue: 0,
    })));
  }, [group, activeMembers, isEdit]);

  useEffect(() => {
    if (!group || !isEdit || !expense) return;
    setPaidByUserId((prev) => prev || group.members?.[0]?.id || '');
  }, [group, expense, isEdit]);

  const handleSplitChange = (userId, field, value) => {
    setSplits((current) => current.map((split) => (
      split.userId === userId ? { ...split, [field]: value } : split
    )));
  };

  const { calculated: previewRows, error: previewError } = useMemo(() => {
    return calculateExpensePreview({
      totalAmount,
      splitType,
      splits,
      paidByUserId,
    });
  }, [totalAmount, splitType, splits, paidByUserId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Expense title is required.');
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      setFormError('Enter a valid total amount.');
      return;
    }
    if (!paidByUserId) {
      setFormError('Select who paid the expense.');
      return;
    }
    if (previewError) {
      setFormError(previewError);
      return;
    }

    const payload = buildPayloadFromForm({
      title: title.trim(),
      description: description.trim(),
      totalAmount,
      splitType,
      currency: currency.trim() || 'INR',
      paidByUserId,
      groupId,
      date,
      splits: previewRows,
    });

    try {
      setSaving(true);
      if (isEdit) {
        await updateExpense(expenseId, payload);
        navigate(`/groups/${groupId}/expenses/${expenseId}`);
      } else {
        await createExpense(payload);
        navigate(`/groups/${groupId}/expenses`);
      }
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Unable to save expense.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-shell">
        <p>Loading expense form...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <div className="error-message">{error}</div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1>{isEdit ? 'Edit expense' : 'Create new expense'}</h1>
          <p>{group?.name}</p>
        </div>
      </div>

      <form className="form-shell" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Dinner, taxi, groceries..."
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional notes"
            rows={3}
          />
        </label>

        <div className="form-row">
          <label>
            Total amount
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(event) => setTotalAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label>
            Currency
            <input
              type="text"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              placeholder="INR"
              required
            />
          </label>

          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Paid by
            <select value={paidByUserId} onChange={(event) => setPaidByUserId(event.target.value)} required>
              <option value="">Select payer</option>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>

          <label>
            Split type
            <select value={splitType} onChange={(event) => setSplitType(event.target.value)}>
              {splitOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <section className="split-detail-section">
          <h2>Split values</h2>
          <p>Adjust amounts or values for each member.</p>
          <table className="split-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>{splitType === 'UNEQUAL' ? 'Amount' : splitType === 'PERCENTAGE' ? 'Percent' : splitType === 'SHARE' ? 'Share' : 'Equal share'}</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((split) => (
                <tr key={split.userId}>
                  <td>{split.name}</td>
                  <td>
                    {splitType === 'EQUAL' ? (
                      <span>Auto equal</span>
                    ) : (
                      <input
                        type="number"
                        step={splitType === 'PERCENTAGE' ? '0.1' : '0.01'}
                        value={splitType === 'UNEQUAL' ? split.amount : split.splitValue}
                        onChange={(event) => handleSplitChange(split.userId, splitType === 'UNEQUAL' ? 'amount' : 'splitValue', event.target.value)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="preview-section">
          <h2>Preview</h2>
          {previewError ? (
            <div className="error-message">{previewError}</div>
          ) : (
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((item) => {
                  const member = activeMembers.find((m) => m.id === item.userId);
                  return (
                    <tr key={item.userId}>
                      <td>{member?.name || item.userId}{item.userId === paidByUserId ? ' (payer)' : ''}</td>
                      <td>{currency} {Number(item.amount).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {formError && <div className="error-message">{formError}</div>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update expense' : 'Create expense'}</button>
          <button type="button" className="secondary-button" onClick={() => navigate(`/groups/${groupId}/expenses`)}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
};

export default ExpenseFormPage;
