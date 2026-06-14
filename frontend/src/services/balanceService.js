import api from './api';

export const fetchGroupBalances = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/balances`);
  return response.data;
};

export const fetchGlobalBalances = async () => {
  const response = await api.get('/auth/me/balances');
  return response.data;
};
