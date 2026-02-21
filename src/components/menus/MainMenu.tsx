import { supabase } from '../../lib/supabase/client';

interface Props {
  onJoinGame: (gameId: string) => void;
  onCreateGame: () => void;
}

/**
 * MainMenu - shown before entering a game session.
 */
export function MainMenu({ onJoinGame, onCreateGame }: Props) {
  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({ provider: 'github' });
  }

  return (
    <div className="main-menu">
      <h1 className="game-title">Pixelduchy</h1>
      <p className="game-tagline">Rule your duchy. Please the king. Outlast your rivals.</p>
      <div className="menu-buttons">
        <button className="btn-primary" onClick={onCreateGame}>
          Create Game
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            const id = prompt('Enter game ID:');
            if (id) onJoinGame(id.trim());
          }}
        >
          Join Game
        </button>
        <button className="btn-ghost" onClick={handleSignIn}>
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}
