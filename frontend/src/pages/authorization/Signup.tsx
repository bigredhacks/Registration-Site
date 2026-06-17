import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import brhLogo from "@/assets/brh_logo_red_text.png";

export default function Signup() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: `${formData.firstName} ${formData.lastName}`,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for the confirmation link!");
    }

    setLoading(false);
  };

  const handleGoogleSignUp = async () => {
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

  const fields = [
    { id: "firstName", label: "First Name", type: "text", placeholder: "First Name" },
    { id: "lastName", label: "Last Name", type: "text", placeholder: "Last Name" },
    { id: "email", label: "Email", type: "email", placeholder: "Email" },
    { id: "password", label: "Password", type: "password", placeholder: "Password" },
    { id: "confirmPassword", label: "Confirm Password", type: "password", placeholder: "Confirm Password" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red1 to-red3 flex items-center justify-center p-4">
      <div className="bg-white3 rounded-2xl p-8 w-full max-w-[450px] shadow-xl flex flex-col items-center">
        <div className="flex flex-col items-center mb-6">
          <img
            src={brhLogo}
            alt="Big Red Hacks Logo"
            className="w-40 mb-2"
          />
          <h1 className="text-brown1 text-xl font-medium font-poppins">Create New Account</h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          {fields.map((field) => (
            <div key={field.id} className="px-4 font-poppins">
              <label htmlFor={field.id} className="block text-sm font-medium text-brown3 mb-1">
                {field.label} <span className="text-red4">*</span>
              </label>
              <input
                id={field.id}
                type={field.type}
                required
                className="text-brown3 w-full px-4 py-3 border border-brown3 rounded-lg focus:ring-2 focus:ring-red4 focus:border-transparent outline-none transition"
                placeholder={field.placeholder}
                value={(formData as Record<string, string>)[field.id]}
                onChange={(e) => handleChange(field.id, e.target.value)}
              />
            </div>
          ))}

          {error && (
            <div className="px-4">
              <p className="text-red4 text-sm font-poppins">{error}</p>
            </div>
          )}

          {message && (
            <div className="px-4">
              <p className="text-green-600 text-sm font-poppins">{message}</p>
            </div>
          )}

          <div className="w-full px-4 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red4 text-white py-3 rounded-lg font-bold font-poppins hover:bg-red3 transition shadow-md disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="w-full mt-6 mb-4 px-4">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-brown3"></div>
            <span className="px-3 text-sm text-brown3 font-poppins bg-white3">or</span>
            <div className="flex-grow border-t border-brown3"></div>
          </div>
        </div>

        {/* Google Sign Up */}
        <div className="w-full px-4 mb-4">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium font-poppins hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-2"
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

        <p className="mt-4 text-sm text-brown3 font-poppins">
          Already have an account? <Link to="/login" className="underline hover:text-red4 transition">Login</Link>
        </p>
      </div>
    </div>
  );
}
