import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <span className="navbar-brand-icon" aria-hidden="true">
            &#9670;
          </span>
          Universal Gaming Knowledge Agent
        </NavLink>
        <nav className="navbar-links">
          <NavLink to="/" className={navLinkClass} end>
            Dashboard
          </NavLink>
          <NavLink to="/games" className={navLinkClass}>
            Games
          </NavLink>
          <NavLink to="/games/new" className={navLinkClass}>
            Add Game
          </NavLink>
          <NavLink to="/chat" className={navLinkClass}>
            Chat
          </NavLink>
        </nav>
        <div className="navbar-account">
          <span className="navbar-username">{user?.username}</span>
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
