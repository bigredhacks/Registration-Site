import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase";
import brhLogo from "@/assets/brh_logo_red_text.png";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.");
      }
      setSessionChecked(true);
    };

    checkSession();
  }, []);

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      navigate("/dashboard");
    }

    setLoading(false);
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red1 to-red3 flex items-center justify-center">
        <p className="text-white font-poppins text-2xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red1 to-red3 flex items-center justify-center px-4">
      <div className="bg-white3 rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <h1 className="text-2xl text-brown1 text-center mb-2 font-poppins">
          <img
            src={brhLogo}
            alt="logo"
            className="mx-auto mb-6 w-40"
          />
          Reset Password
        </h1>
        <p className="text-brown3 text-center mb-6 font-poppins">
          Enter your new password below.
        </p>

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="px-16 font-poppins">
            <label htmlFor="password" className="block text-sm font-medium text-brown3 mb-2">
              New Password <span className="text-red4">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="text-brown3 w-full px-4 py-3 border border-brown3 rounded-lg focus:ring-2 focus:ring-red4 focus:border-transparent outline-none transition"
              placeholder="New password"
            />
          </div>

          <div className="px-16 font-poppins">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-brown3 mb-2">
              Confirm Password <span className="text-red4">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="text-brown3 w-full px-4 py-3 border border-brown3 rounded-lg focus:ring-2 focus:ring-red4 focus:border-transparent outline-none transition"
              placeholder="Confirm password"
            />
          </div>

          {error && (
            <div className="px-16">
              <p className="text-red4 text-sm font-poppins">{error}</p>
            </div>
          )}

          <div className="px-5">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red4 text-white py-2.5 rounded-lg font-semibold font-poppins hover:bg-red3 transition shadow-md disabled:opacity-50"
            >
              {loading ? "Updating..." : "Set New Password"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/login")}
            className="underline text-brown3 hover:text-red4 font-medium font-poppins transition"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
