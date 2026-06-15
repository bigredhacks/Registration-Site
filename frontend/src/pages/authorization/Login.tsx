import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import brhLogo from "@/assets/brh_logo_red_text.png";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate("/dashboard");
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for the password reset link");
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        setError(error.message);
      }
    } catch {
      setError("An unexpected error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red1 to-red3 flex items-center justify-center px-4">
      <div className="bg-white3 rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <h1 className="text-2xl text-brown1 text-center mb-2 font-poppins">
            <img
            src={brhLogo}
            alt="logo"
            className="mx-auto mb-6 w-40"
            />
          Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="px-16 font-poppins">
            <label htmlFor="email" className="block text-sm font-medium text-brown3 mb-2">
              Email <span className="text-red4">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-brown3 w-full px-4 py-3 border border-brown3 rounded-lg focus:ring-2 focus:ring-red4 focus:border-transparent outline-none transition"
              placeholder="Email"
            />
          </div>

          <div className="px-16 font-poppins">
            <label htmlFor="password" className="block text-sm font-medium text-brown3 mb-2">
              Password <span className="text-red4">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-brown3 w-full px-4 py-3 border border-brown3 rounded-lg focus:ring-2 focus:ring-red4 focus:border-transparent outline-none transition"
              placeholder="Password"
            />
          </div>

          <div className="text-center font-poppins text-sm text-brown3">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="underline hover:text-red4 transition"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div className="px-16">
              <p className="text-red4 text-sm font-poppins">{error}</p>
            </div>
          )}

          {message && (
            <div className="px-16">
              <p className="text-green-600 text-sm font-poppins">{message}</p>
            </div>
          )}

          <div className="px-5">
            <button
                type="submit"
                disabled={loading}
                className="w-full bg-red4 text-white py-2.5 rounded-lg font-semibold font-poppins hover:bg-red3 transition shadow-md disabled:opacity-50"
            >
                {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>

        </form>

        {/* Divider */}
        <div className="mt-6 mb-6 px-5">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-brown3"></div>
            <span className="px-3 text-sm text-brown3 font-poppins bg-white3">or</span>
            <div className="flex-grow border-t border-brown3"></div>
          </div>
        </div>

        {/* Google Sign In */}
        <div className="px-5 mb-6">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium font-poppins hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="mt-6 text-center">
            <Link to="/signup" className="underline text-brown3 hover:text-red4 font-medium font-poppins transition">
              Create New Account
            </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
