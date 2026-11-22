import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { gameService } from "../services/gameService";
import { useAsync } from "../hooks/useAsync";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { GameForm } from "../components/GameForm";
import { type GameFormValues, toGameInput } from "../utils/gameValidation";
import { getErrorMessage } from "../utils/errors";

export function EditGamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: game,
    loading,
    error,
    reload,
  } = useAsync(() => gameService.getById(id as string), [id]);

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(values: GameFormValues) {
    if (!id) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await gameService.update(id, toGameInput(values));
      navigate(`/games/${id}`, { replace: true });
    } catch (err) {
      setApiError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Edit Game</h1>

      {loading && <LoadingState label="Loading game..." />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && game && (
        <div className="card">
          <GameForm
            initialValues={{
              title: game.title,
              slug: game.slug,
              description: game.description ?? "",
              releaseDate: game.releaseDate
                ? game.releaseDate.slice(0, 10)
                : "",
              developer: game.developer ?? "",
              publisher: game.publisher ?? "",
            }}
            submitLabel="Save Changes"
            submitting={submitting}
            apiError={apiError}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  );
}
