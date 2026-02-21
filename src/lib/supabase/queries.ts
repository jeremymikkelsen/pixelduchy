import { supabase } from './client';
import type { GameSession, Duchy, Player } from '../../types';

// ─── Games ────────────────────────────────────────────────────────────────────

export async function createGame(hostPlayerId: string): Promise<GameSession> {
  const { data, error } = await supabase
    .from('games')
    .insert({ created_by: hostPlayerId })
    .select()
    .single();
  if (error) throw error;
  return data as GameSession;
}

export async function getGame(gameId: string): Promise<GameSession> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();
  if (error) throw error;
  return data as GameSession;
}

// ─── Duchies ──────────────────────────────────────────────────────────────────

export async function getDuchies(gameId: string): Promise<Duchy[]> {
  const { data, error } = await supabase
    .from('duchies')
    .select('*')
    .eq('game_id', gameId);
  if (error) throw error;
  return data as Duchy[];
}

export async function updateDuchy(duchyId: string, patch: Partial<Duchy>): Promise<void> {
  const { error } = await supabase
    .from('duchies')
    .update(patch)
    .eq('id', duchyId);
  if (error) throw error;
}

export async function setTurnReady(duchyId: string): Promise<void> {
  await updateDuchy(duchyId, { turnReady: true });
}

// ─── Players ──────────────────────────────────────────────────────────────────

export async function getPlayers(gameId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('game_players')
    .select('profiles(*)')
    .eq('game_id', gameId);
  if (error) throw error;
  return (data as any[]).map((row) => row.profiles) as Player[];
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export function subscribeToGame(
  gameId: string,
  onUpdate: (payload: any) => void,
) {
  return supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, onUpdate)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'duchies', filter: `game_id=eq.${gameId}` }, onUpdate)
    .subscribe();
}
