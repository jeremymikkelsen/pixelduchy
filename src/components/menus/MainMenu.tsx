interface Props {
  onJoinGame: (gameId: string) => void;
  onCreateGame: () => void;
}

/**
 * MainMenu - shown before entering a game session.
 */
export function MainMenu({ onCreateGame }: Props) {
  return (
    <div className="main-menu">
      <h1 className="game-title">Pixelduchy</h1>
      <p className="game-tagline">Rule your duchy. Please the king. Outlast your rivals.</p>
      <div className="menu-buttons">
        <button className="btn-primary" onClick={onCreateGame}>
          Create Game
        </button>
      </div>
    </div>
  );
}
