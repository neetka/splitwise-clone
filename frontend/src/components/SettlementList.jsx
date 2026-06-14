const SettlementList = ({ settlements, currentUserId, showGroup }) => {
  if (!settlements?.length) {
    return <p>No settlements found.</p>;
  }

  return (
    <table className="expense-table">
      <thead>
        <tr>
          {showGroup && <th>Group</th>}
          <th>Payer</th>
          <th>Receiver</th>
          <th>Amount</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {settlements.map((settlement) => (
          <tr key={settlement.id}>
            {showGroup && <td>{settlement.group?.name || settlement.groupId}</td>}
            <td>
              {settlement.payer?.id === currentUserId ? 'You' : settlement.payer?.name || settlement.payer?.email}
            </td>
            <td>
              {settlement.receiver?.id === currentUserId ? 'You' : settlement.receiver?.name || settlement.receiver?.email}
            </td>
            <td>{settlement.currency} {Number(settlement.amount).toFixed(2)}</td>
            <td>{new Date(settlement.date).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default SettlementList;
