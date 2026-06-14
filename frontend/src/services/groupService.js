import api from './api';

export const fetchGroups = async () => {
  const response = await api.get('/groups');
  return response.data;
};

export const createGroup = async (name) => {
  const response = await api.post('/groups', { name });
  return response.data;
};

export const fetchGroupDetails = async (groupId) => {
  const response = await api.get(`/groups/${groupId}`);
  return response.data;
};

export const addGroupMember = async (groupId, email) => {
  const response = await api.post(`/groups/${groupId}/members`, { email });
  return response.data;
};

export const removeGroupMember = async (groupId, memberId) => {
  const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
  return response.data;
};
