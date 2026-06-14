import api from './api';

export const fetchGroupSettlements = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/settlements`);
  return response.data;
};

export const fetchMySettlements = async () => {
  const response = await api.get('/auth/me/settlements');
  return response.data;
};

export const createSettlement = async (payload) => {
  const response = await api.post('/settlements', payload);
  return response.data;
};
