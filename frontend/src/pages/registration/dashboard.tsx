import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RegistrationLayout from "../../components/layouts/RegistrationLayout";
import { useToast } from "../../components/Toast/ToastContext";
import ApplicationPanel from "../../components/registration/ApplicationPanel";
import { supabase } from "../../config/supabase";
import arcade from "@/assets/arcade_device2.png";
import siteBanner from "@/assets/site_banner.png";

const EVENT_DATE = new Date("2026-10-16T09:00:00");

function useCountdown(target: Date) {
  const calc = () => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [countdown, setCountdown] = useState(calc);
  const started = useRef(false);

  if (!started.current) {
    started.current = true;
    const tick = () => {
      setCountdown(calc());
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);
  }

  return countdown;
}

function profileCompletion(): { pct: number; missing: string[] } {
  try {
    const saved = JSON.parse(localStorage.getItem("brh_profile") || "{}");
    const fields: Record<string, string> = {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phoneNumber: "Phone Number",
      age: "Age",
      graduationYear: "Graduation Year",
      university: "University",
      major: "Major",
      gender: "Gender",
      dietaryRestrictions: "Dietary Restrictions",
      shirtSize: "Shirt Size",
    };
    const isEmpty = (v: unknown) =>
      v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    const missing = Object.entries(fields).filter(([k]) => isEmpty(saved[k])).map(([, v]) => v);
    const pct = Math.round(((Object.keys(fields).length - missing.length) / Object.keys(fields).length) * 100);
    return { pct, missing };
  } catch {
    return { pct: 0, missing: ["Profile not set up"] };
  }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[40px]">
      <span className="text-3xl font-jersey10 text-red6 leading-none tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-poppins text-gray-400 mt-1 uppercase tracking-wider">{label}</span>
    </div>
  );
}

const Dashboard = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const countdown = useCountdown(EVENT_DATE);
  const { pct, missing } = profileCompletion();

  const [panelOpen, setPanelOpen] = useState(location.pathname === "/register");
  const [hasApplied, setHasApplied] = useState(false);

  // Email verification state
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null); // null = loading
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setUserEmail(user?.email ?? null);
      setEmailVerified(!!user?.email_confirmed_at);
    });
  }, []);

  useEffect(() => {
    if (location.pathname === "/register") {
      setPanelOpen(true);
    }
  }, [location.pathname]);

  const handlePanelClose = () => {
    setPanelOpen(false);
    if (location.pathname === "/register") {
      navigate("/dashboard");
    }
  };

  const handleVerifyEmail = async () => {
    if (!userEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: userEmail });
    setResending(false);
    if (error) {
      showToast(`Could not send email: ${error.message}`, "error");
    } else {
      showToast("Verification email sent! Check your inbox.", "info");
    }
  };

  return (
    <RegistrationLayout>
      <div className="flex flex-col gap-4 px-2 py-2">
        <h1 className="text-3xl font-poppins font-bold text-red6 pl-1">Dashboard</h1>

        {/* Top row: Status + Countdown */}
        <div className="grid grid-cols-2 gap-4">

          {/* Application Status */}
          <div className="bg-white border border-red7 rounded-xl p-6 flex flex-col gap-3 shadow-sm">
            <p className="text-[11px] font-poppins font-semibold text-gray-400 uppercase tracking-widest">Application</p>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${hasApplied ? "bg-green-500" : "bg-amber-400"}`} />
              <span className="font-poppins font-semibold text-gray-800">
                {hasApplied ? "Submitted" : "Not Started"}
              </span>
            </div>
            <p className="text-sm font-poppins text-gray-500 leading-relaxed">
              {hasApplied
                ? "Your application is under review. We'll be in touch soon."
                : "Complete your profile, then submit your application below."}
            </p>
            <button
              onClick={() => setPanelOpen(true)}
              disabled={hasApplied}
              className="mt-auto w-full py-2 rounded-lg bg-red5 hover:bg-red3 text-white text-sm font-poppins font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasApplied ? "Application Submitted ✓" : "Apply Now →"}
            </button>
          </div>

          {/* Countdown */}
          <div className="bg-red7 border border-red7 rounded-xl p-6 flex flex-col gap-3 shadow-sm">
            <p className="text-[11px] font-poppins font-semibold text-red6 uppercase tracking-widest">Big Red Hacks 2026</p>
            <p className="font-poppins text-gray-700 text-sm leading-relaxed">
              The largest student-run hackathon @ Cornell University, Ithaca NY.
            </p>
            <div className="flex items-end gap-3 mt-auto pt-3 border-t border-red5/20">
              <CountdownUnit value={countdown.days} label="days" />
              <span className="text-xl font-jersey10 text-red5 mb-4">:</span>
              <CountdownUnit value={countdown.hours} label="hrs" />
              <span className="text-xl font-jersey10 text-red5 mb-4">:</span>
              <CountdownUnit value={countdown.minutes} label="min" />
              <span className="text-xl font-jersey10 text-red5 mb-4">:</span>
              <CountdownUnit value={countdown.seconds} label="sec" />
            </div>
          </div>
        </div>

        {/* Email verification — only show if not yet verified */}
        {emailVerified === false && (
          <div className="bg-white border border-amber-200 rounded-xl px-6 py-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-poppins font-semibold text-gray-800 text-sm">Verify your email</p>
              <p className="text-xs font-poppins text-gray-500 mt-0.5">
                We sent a link to <span className="font-medium text-gray-700">{userEmail}</span>. Verify to secure your account and receive hackathon updates.
              </p>
            </div>
            <button
              onClick={handleVerifyEmail}
              disabled={resending}
              className="ml-4 shrink-0 px-5 py-2 bg-red5 hover:bg-red3 text-white text-sm font-poppins font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend Email"}
            </button>
          </div>
        )}
        {emailVerified === true && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-3 flex items-center gap-3 shadow-sm">
            <span className="text-green-600 font-bold text-lg">✓</span>
            <p className="font-poppins text-sm text-green-700 font-medium">Email verified — you're all set.</p>
          </div>
        )}

        {/* Profile Completion */}
        <div className="bg-white border border-red7 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-poppins font-semibold text-gray-800">Profile Completion</p>
            <span className="text-sm font-poppins font-bold text-red6">{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-red7 rounded-full overflow-hidden">
            <div className="h-full bg-red5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {missing.length > 0 && (
            <p className="text-xs font-poppins text-gray-400 mt-2">
              Missing: {missing.slice(0, 4).join(", ")}{missing.length > 4 ? ` +${missing.length - 4} more` : ""}
            </p>
          )}
          {pct < 100 && (
            <button
              onClick={() => navigate("/profile")}
              className="mt-2 text-sm font-poppins font-semibold text-red5 hover:text-red6 transition-colors"
            >
              Complete profile →
            </button>
          )}
        </div>

        {/* Site banner / CTA post — click to open registration form */}
        <div className="relative group">
          {/* "post" pole */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setPanelOpen(true)}
              className="relative w-full rounded-xl overflow-hidden shadow-lg cursor-pointer hover-wiggle"
              aria-label="Open application form"
            >
              <img
                src={siteBanner}
                alt="BigRed//Hacks — click to apply"
                className="w-full object-cover rounded-xl"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center rounded-xl">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red5 text-white font-poppins font-bold text-lg px-8 py-3 rounded-xl shadow-xl">
                  {hasApplied ? "View Application" : "Apply to BigRed//Hacks →"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Arcade + Hack On */}
        <div className="bg-red7 rounded-xl flex items-center justify-center gap-8 py-8 px-10 shadow-sm">
          <img src={arcade} alt="arcade machine" className="w-56 drop-shadow-lg" />
          <p className="text-8xl font-jersey10 text-purple9 leading-tight select-none">
            Hack<br />On!
          </p>
        </div>

      </div>

      <ApplicationPanel
        isOpen={panelOpen}
        onClose={handlePanelClose}
        onSubmitted={() => {
          setHasApplied(true);
          setPanelOpen(false);
          if (location.pathname === "/register") {
            navigate("/dashboard");
          }
          showToast("Application submitted! We'll be in touch soon.", "success");
        }}
      />
    </RegistrationLayout>
  );
};

export default Dashboard;
