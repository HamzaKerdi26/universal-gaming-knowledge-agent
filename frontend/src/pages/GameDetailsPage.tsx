import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { gameService } from "../services/gameService";
import { useAsync } from "../hooks/useAsync";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDate } from "../utils/date";
import { getErrorMessage } from "../utils/errors";

export function GameDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: game,
    loading,
    error,
    reload,
  } = useAsync(() => gameService.getById(id as string), [id]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await gameService.remove(id);
      navigate("/games", { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <Link to="/games" className="link back-link">
        &larr; Back to games
      </Link>

      {loading && <LoadingState label="Loading game..." />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && game && (
        <div className="card details-card">
          <div className="details-header">
            <h1>{game.title}</h1>
            <span className="badge">{game.slug}</span>
          </div>

          {game.description && (
            <p className="details-description">{game.description}</p>
          )}

          <dl className="details-grid">
            <div>
              <dt>Release date</dt>
              <dd>{formatDate(game.releaseDate)}</dd>
            </div>
            <div>
              <dt>Developer</dt>
              <dd>{game.developer ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Publisher</dt>
              <dd>{game.publisher ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>{formatDate(game.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(game.updatedAt)}</dd>
            </div>
          </dl>

          <div className="details-actions">
            <Link to={`/games/${game.id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmOpen(true)}
            >
              Delete
            </button>
          </div>

          {deleteError && (
            <div className="form-api-error" role="alert">
              {deleteError}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete game"
        message={
          game
            ? `Are you sure you want to delete "${game.title}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
