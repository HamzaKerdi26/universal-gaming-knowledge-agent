import { useState } from "react";
import { Link } from "react-router-dom";
import { gameService } from "../services/gameService";
import { useAsync } from "../hooks/useAsync";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { GameCard } from "../components/GameCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { Game } from "../types";
import { getErrorMessage } from "../utils/errors";

export function GamesListPage() {
  const { data: games, loading, error, reload } = useAsync(
    () => gameService.list(),
    []
  );

  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!gameToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await gameService.remove(gameToDelete.id);
      setGameToDelete(null);
      reload();
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Games</h1>
        <Link to="/games/new" className="btn btn-primary">
          + Add Game
        </Link>
      </div>

      {loading && <LoadingState label="Loading games..." />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && games && games.length === 0 && (
        <EmptyState
          title="No games yet"
          message="Add your first game to start building the catalog."
          action={
            <Link to="/games/new" className="btn btn-primary">
              Add Game
            </Link>
          }
        />
      )}

      {!loading && !error && games && games.length > 0 && (
        <div className="game-grid">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onDelete={(g) => {
                setDeleteError(null);
                setGameToDelete(g);
              }}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={gameToDelete !== null}
        title="Delete game"
        message={
          gameToDelete
            ? `Are you sure you want to delete "${gameToDelete.title}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setGameToDelete(null)}
      />
      {deleteError && (
        <div className="form-api-error" role="alert">
          {deleteError}
        </div>
      )}
    </div>
  );
}
