import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./App.css";
import { supabase } from "./config/supabase";
import brhLogo from "@/assets/brh_logo_red_text.png";
import siteBanner from "@/assets/site_banner.png";

function App() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session);
    });
  }, []);

  return (
    <main className="min-h-screen bg-white3 text-brown1">
      <section className="relative flex min-h-[92vh] items-center overflow-hidden px-6 py-10 sm:px-10 lg:px-16">
        <img
          src={siteBanner}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white3 via-white3/95 to-red7/90" />

        <div className="relative z-10 max-w-4xl">
          <img
            src={brhLogo}
            alt="Big Red Hacks"
            className="mb-10 w-48 sm:w-56"
          />
          <p className="mb-4 font-poppins text-sm font-semibold uppercase tracking-[0.28em] text-red5">
            Fall Registration
          </p>
          <h1 className="font-jersey10 text-[72px] leading-[0.88] text-red6 sm:text-[104px] lg:text-[132px]">
            BigRed<span className="text-red5">//</span>Hacks
          </h1>
          <p className="mt-8 max-w-2xl font-poppins text-lg leading-8 text-brown3">
            Create an account, complete your profile, and submit your hackathon application from the registration dashboard.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {authenticated ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-red5 px-8 py-3 text-center font-poppins text-sm font-semibold text-white shadow-md transition hover:bg-red3"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg bg-red5 px-8 py-3 text-center font-poppins text-sm font-semibold text-white shadow-md transition hover:bg-red3"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg border border-red5 bg-white/70 px-8 py-3 text-center font-poppins text-sm font-semibold text-red5 transition hover:bg-white"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="border-t border-red5/10 bg-white px-6 py-5 sm:px-10 lg:px-16">
        <p className="font-poppins text-sm text-brown3">
          Profile, application, and team matching for BigRed//Hacks.
        </p>
      </section>
    </main>
  );
}

export default App;
