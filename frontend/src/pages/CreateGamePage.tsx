import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { gameService } from "../services/gameService";
import { GameForm } from "../components/GameForm";
import { type GameFormValues, toGameInput } from "../utils/gameValidation";
import { getErrorMessage } from "../utils/errors";

const emptyValues: GameFormValues = {
  title: "",
  slug: "",
  description: "",
  releaseDate: "",
  developer: "",
  publisher: "",
};

export function CreateGamePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(values: GameFormValues) {
    setSubmitting(true);
    setApiError(null);
    try {
      const created = await gameService.create(toGameInput(values));
      navigate(`/games/${created.id}`, { replace: true });
    } catch (err) {
      setApiError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Add Game</h1>
      <div className="card">
        <GameForm
          initialValues={emptyValues}
          submitLabel="Create Game"
          submitting={submitting}
          apiError={apiError}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
