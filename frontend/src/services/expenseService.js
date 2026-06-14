import api from './api';

export const fetchGroupExpenses = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/expenses`);
  return response.data;
};

export const fetchExpense = async (expenseId) => {
  const response = await api.get(`/expenses/${expenseId}`);
  return response.data;
};

export const createExpense = async (payload) => {
  const response = await api.post('/expenses', payload);
  return response.data;
};

export const updateExpense = async (expenseId, payload) => {
  const response = await api.put(`/expenses/${expenseId}`, payload);
  return response.data;
};

export const deleteExpense = async (expenseId) => {
  const response = await api.delete(`/expenses/${expenseId}`);
  return response.data;
};
