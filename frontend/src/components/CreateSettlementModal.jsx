import { useState, useEffect } from 'react';

const CreateSettlementModal = ({ open, onClose, members, defaultCurrency = 'INR', onSubmit, submitting, error }) => {
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [date, setDate] = useState('');

  useEffect(() => {
    if (!open) return;
    setReceiverId(members?.[0]?.id || '');
    setAmount('');
    setCurrency(defaultCurrency);
    setDate(new Date().toISOString().slice(0, 10));
  }, [open, members, defaultCurrency]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({ receiverId, amount, currency, date });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2>Settle a balance</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Pay to
            <select value={receiverId} onChange={(event) => setReceiverId(event.target.value)} required>
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
              required
            />
          </label>

          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Settle payment'}</button>
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSettlementModal;
