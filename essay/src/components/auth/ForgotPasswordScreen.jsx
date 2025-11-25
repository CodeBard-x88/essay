import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, RefreshCw } from "lucide-react";

const ForgotPasswordScreen = ({ darkMode, toggleDarkMode, handleForgotPassword }) => {
  const [email, setEmail] = useState("");

  return (
    <div
      className={`flex items-center justify-center min-h-screen p-6 ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      <div
        className={`w-full max-w-md p-8 rounded-2xl shadow-lg ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6" /> Reset Password
          </h2>
          <button
            onClick={toggleDarkMode}
            className="text-sm px-3 py-1 rounded-lg border"
          >
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>

        <form onSubmit={(e) => handleForgotPassword(e, email)} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full pl-10 pr-3 py-3 rounded-lg border focus:ring-2 focus:border-blue-500 transition
                ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white focus:ring-blue-400"
                    : "bg-gray-50 border-gray-300 text-gray-900 focus:ring-blue-500"
                }`}
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
          >
            Send Reset Link
          </button>
        </form>

        {/* Back to login */}
        <p className="mt-4 text-sm text-center">
          Remembered your password?{" "}
          <Link to="/login" className="text-blue-500 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
