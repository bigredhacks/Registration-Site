import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import ToastProvider from "./components/Toast/ToastProvider";
import TeamPage from "@/pages/TeamPage.tsx";
import Login from "./pages/authorization/Login";
import Signup from "./pages/authorization/Signup";
import Dashboard from "./pages/registration/dashboard";
import Profile from "./pages/registration/profile";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/register" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/apply" element={<Navigate to="/register" replace />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  </StrictMode>
);
