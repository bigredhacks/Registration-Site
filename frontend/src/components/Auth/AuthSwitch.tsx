"use client";

import { useState } from "react";

interface AuthSwitchProps {
  loginForm: React.ReactNode;
  registerForm: React.ReactNode;
}

export default function AuthSwitch({
  loginForm,
  registerForm,
}: AuthSwitchProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);

  return (
    <>
      <div className="flex justify-center">
        <img
          src="/brh-horizontal-red.png"
          alt="BigRed//Hacks Logo"
          className="h-24 w-auto"
          draggable="false"
        />
      </div>
      <h1 className="text-xl font-light text-center mt-6 mb-4 text-brown-dark">
        {isLogin ? "Login" : "Create New Account"}
      </h1>
      {isLogin ? loginForm : registerForm}

      <div className="mt-2 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm font-light underline text-brown-light hover:text-brown-dark"
        >
          {isLogin ? "Create New Account" : "Already have an account? Login"}
        </button>
      </div>
    </>
  );
}
