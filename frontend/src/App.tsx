import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { GamesListPage } from "./pages/GamesListPage";
import { GameDetailsPage } from "./pages/GameDetailsPage";
import { CreateGamePage } from "./pages/CreateGamePage";
import { EditGamePage } from "./pages/EditGamePage";
import { ChatPage } from "./pages/ChatPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AuthPage } from "./pages/AuthPage";
import { useAuth } from "./hooks/useAuth";

export function App() {
  const { user, isLoading, restoreError } = useAuth();

  if (isLoading) {
    return <main className="auth-loading"><div className="spinner" /><p>Restoring your session...</p></main>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" initialError={restoreError} />} />
        <Route path="/register" element={<AuthPage mode="register" initialError={restoreError} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="games" element={<GamesListPage />} />
        <Route path="games/new" element={<CreateGamePage />} />
        <Route path="games/:id" element={<GameDetailsPage />} />
        <Route path="games/:id/edit" element={<EditGamePage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
