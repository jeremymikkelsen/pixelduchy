import { useGameStore } from '../../store/gameStore';

/**
 * GameResultOverlay - shown on victory or defeat.
 */
export function GameResultOverlay() {
  const { victory, gameOver, restartGame, session } = useGameStore();

  if (!victory && !gameOver) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-box result-modal">
        {victory ? (
          <>
            <div className="result-icon">🏆</div>
            <h1 className="result-title result-victory">Victory!</h1>
            <p className="result-desc">
              You ruled your duchy wisely for {session?.maxTurns} turns and kept the King's favor.
              Your legacy endures.
            </p>
          </>
        ) : (
          <>
            <div className="result-icon">💀</div>
            <h1 className="result-title result-defeat">Duchy Fallen</h1>
            <p className="result-desc">
              The King has stripped you of your title. Your duchy is dissolved and your lands
              redistributed.
            </p>
          </>
        )}
        <button className="btn-primary result-btn" onClick={restartGame}>
          Play Again
        </button>
      </div>
    </div>
  );
}
