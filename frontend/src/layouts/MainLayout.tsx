import { Outlet } from "react-router-dom";
import { Navbar } from "../components/Navbar";

export function MainLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-content">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>Universal Gaming Knowledge Agent &mdash; Phase 2 (Frontend)</p>
      </footer>
    </div>
  );
}
