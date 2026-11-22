import { Link } from "react-router-dom";
import { gameService } from "../services/gameService";
import { useAsync } from "../hooks/useAsync";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { formatDate } from "../utils/date";

export function DashboardPage() {
  const { data: games, loading, error, reload } = useAsync(
    () => gameService.list(),
    []
  );

  const recentGames = games
    ? [...games]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5)
    : [];

  return (
    <div className="page dashboard-page">
      <section className="hero">
        <h1>Universal Gaming Knowledge Agent</h1>
        <p>
          A growing knowledge platform for video games — currently the
          backend foundation and management UI, with AI-powered answers
          planned for a later phase.
        </p>
        <Link to="/games" className="btn btn-primary">
          Browse Games
        </Link>
        <Link to="/chat" className="btn btn-secondary hero-secondary-cta">
          Chat with the Agent
        </Link>
      </section>

      {loading && <LoadingState label="Loading dashboard..." />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <section className="stats-row">
            <div className="stat-card">
              <span className="stat-value">{games?.length ?? 0}</span>
              <span className="stat-label">Games tracked</span>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <h2>Recently added</h2>
              <Link to="/games" className="link">
                View all
              </Link>
            </div>

            {recentGames.length === 0 ? (
              <p className="muted">No games have been added yet.</p>
            ) : (
              <ul className="recent-list">
                {recentGames.map((game) => (
                  <li key={game.id}>
                    <Link to={`/games/${game.id}`} className="recent-item">
                      <span className="recent-item-title">{game.title}</span>
                      <span className="recent-item-meta">
                        Added {formatDate(game.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
