import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page state-panel">
      <h1>404</h1>
      <p>That page doesn't exist.</p>
      <Link to="/" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}
