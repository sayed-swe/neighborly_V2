'use client';
import { api } from './api';

/** Opens (or creates) the 1:1 conversation with a member and returns its id. */
export async function startConversation(userId) {
  const { data } = await api.post('/conversations', { userId });
  return data.id;
}
