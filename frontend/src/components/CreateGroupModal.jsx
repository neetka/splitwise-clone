import { useState } from 'react';

const CreateGroupModal = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please enter a group name.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await onCreate(name.trim());
      setName('');
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to create group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h2>Create a new group</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Group name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Weekend trip"
              required
            />
          </label>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
