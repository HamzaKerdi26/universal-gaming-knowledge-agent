import { Link } from "react-router-dom";
import type { Game } from "../types";
import { formatDate } from "../utils/date";

interface GameCardProps {
  game: Game;
  onDelete: (game: Game) => void;
}

export function GameCard({ game, onDelete }: GameCardProps) {
  return (
    <article className="card game-card">
      <div className="game-card-header">
        <h3>{game.title}</h3>
        {game.releaseDate && (
          <span className="badge">{formatDate(game.releaseDate)}</span>
        )}
      </div>

      {game.description && (
        <p className="game-card-description">{game.description}</p>
      )}

      <dl className="game-card-meta">
        {game.developer && (
          <div>
            <dt>Developer</dt>
            <dd>{game.developer}</dd>
          </div>
        )}
        {game.publisher && (
          <div>
            <dt>Publisher</dt>
            <dd>{game.publisher}</dd>
          </div>
        )}
      </dl>

      <div className="game-card-actions">
        <Link to={`/games/${game.id}`} className="btn btn-secondary">
          View
        </Link>
        <Link to={`/games/${game.id}/edit`} className="btn btn-secondary">
          Edit
        </Link>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => onDelete(game)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
