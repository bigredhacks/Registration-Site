import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RegistrationLayout from "../../components/layouts/RegistrationLayout";
import { useToast } from "../../components/Toast/ToastContext";
import ApplicationPanel, {
  type RegistrationResponse as ApplicationRegistration,
} from "../../components/registration/ApplicationPanel";
import { supabase } from "../../config/supabase";
import { apiFetch } from "../../lib/api";
import {
  buildApplicationCards,
  type ActiveFormSummary,
  type ApplicationCard,
} from "../../lib/registrationUi";
import arcade from "@/assets/arcade_device2.png";
import siteBanner from "@/assets/site_banner.png";

const EVENT_DATE = new Date("2026-10-02T09:00:00-04:00");

interface UserRegistrationSummary {
  id: number | string;
  form_key?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

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

const PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "phone_number", label: "Phone Number" },
  { key: "age_range", label: "Age" },
  { key: "graduation_year", label: "Graduation Year" },
  { key: "school", label: "University" },
  { key: "country", label: "Country" },
  { key: "level_of_study", label: "Level of Study" },
  { key: "major", label: "Major" },
  { key: "gender", label: "Gender" },
  { key: "dietary_restrictions", label: "Dietary Restrictions" },
  { key: "shirt_size", label: "Shirt Size" },
  { key: "linkedin", label: "LinkedIn" },
];

function computeCompletion(profile: Record<string, unknown> | null): { pct: number; missing: string[] } {
  if (!profile) return { pct: 0, missing: ["Profile not set up"] };
  const isEmpty = (value: unknown) =>
    value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  const missing = PROFILE_FIELDS.filter((field) => isEmpty(profile[field.key])).map((field) => field.label);
  const pct = Math.round(((PROFILE_FIELDS.length - missing.length) / PROFILE_FIELDS.length) * 100);
  return { pct, missing };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[40px] flex-col items-center">
      <span className="tabular-nums text-3xl leading-none text-red6 font-jersey10">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-gray-400 font-poppins">{label}</span>
    </div>
  );
}

function getStatusTone(card: ApplicationCard | undefined) {
  if (!card) {
    return { dot: "bg-gray-300", badge: "bg-gray-100 text-gray-500" };
  }

  switch (card.status) {
    case "approved":
      return { dot: "bg-green-500", badge: "bg-green-100 text-green-700" };
    case "rejected":
      return { dot: "bg-red-400", badge: "bg-red-100 text-red-600" };
    case "waitlisted":
      return { dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700" };
    case "submitted":
    case "pending":
      return { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" };
    default:
      return { dot: card.started ? "bg-blue-500" : "bg-amber-400", badge: "bg-red7 text-red6" };
  }
}

function getApplicationSummary(card: ApplicationCard | undefined) {
  if (!card) {
    return {
      headline: "Unavailable",
      body: "The main registration form is not active right now.",
    };
  }

  switch (card.status) {
    case "approved":
      return {
        headline: "Approved",
        body: "Your application has been approved. Open the form to review what you submitted.",
      };
    case "rejected":
      return {
        headline: "Rejected",
        body: "Your application has been reviewed. Open it to confirm the details on file.",
      };
    case "waitlisted":
      return {
        headline: "Waitlisted",
        body: "Your application is still in consideration. Open it any time to review your submission.",
      };
    case "submitted":
    case "pending":
      return {
        headline: card.stateLabel,
        body: "Your application is under review. You can still open it to review or update your answers.",
      };
    default:
      return {
        headline: "Not Started",
        body: "Complete your profile, then submit your application below.",
      };
  }
}

const Dashboard = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const countdown = useCountdown(EVENT_DATE);

  const [panelOpen, setPanelOpen] = useState(location.pathname === "/register");
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [activeForms, setActiveForms] = useState<ActiveFormSummary[]>([]);
  const [registrations, setRegistrations] = useState<UserRegistrationSummary[]>([]);
  const { pct, missing } = computeCompletion(profile);

  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setUserEmail(user?.email ?? null);
      setEmailVerified(!!user?.email_confirmed_at);
    });

    Promise.all([
      apiFetch("/api/profile"),
      apiFetch("/api/form-configs"),
      apiFetch("/api/registrations/me/all"),
    ])
      .then(async ([profileRes, formsRes, registrationsRes]) => {
        if (profileRes.ok) {
          setProfile(await profileRes.json());
        }
        if (formsRes.ok) {
          setActiveForms(await formsRes.json());
        }
        if (registrationsRes.ok) {
          setRegistrations(await registrationsRes.json());
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (location.pathname === "/register") {
      setPanelOpen(true);
    }
  }, [location.pathname]);

  const applicationCards = useMemo(
    () => buildApplicationCards(activeForms, registrations),
    [activeForms, registrations],
  );
  const registrationCard = applicationCards.find((card) => card.key === "registration");
  const visibleCards = applicationCards.filter((card) => card.key !== "registration");
  const registrationSummary = getApplicationSummary(registrationCard);
  const registrationTone = getStatusTone(registrationCard);

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

  const openCard = (card: ApplicationCard) => {
    if (card.key === "registration") {
      setPanelOpen(true);
      return;
    }
    navigate(`/forms/${card.key}`);
  };

  return (
    <RegistrationLayout>
      <div className="flex flex-col gap-4 px-2 py-2">
        <h1 className="pl-1 text-3xl font-bold text-red6 font-poppins">Dashboard</h1>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-red7 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-poppins font-semibold uppercase tracking-widest text-gray-400">
              Application
            </p>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${registrationTone.dot}`} />
              <span className="font-poppins font-semibold text-gray-800">
                {registrationSummary.headline}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500 font-poppins">
              {registrationSummary.body}
            </p>
            <button
              onClick={() => registrationCard && setPanelOpen(true)}
              disabled={!registrationCard}
              className="mt-auto w-full rounded-lg bg-red5 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {registrationCard?.primaryActionLabel ?? "Application Unavailable"}
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-red7 bg-red7 p-6 shadow-sm">
            <p className="text-[11px] font-poppins font-semibold uppercase tracking-widest text-red6">
              BigRed//Hacks FA26
            </p>
            <p className="text-sm leading-relaxed text-gray-700 font-poppins">
              The largest student-run hackathon @ Cornell University, Ithaca NY.
            </p>
            <div className="mt-auto flex items-end gap-3 border-t border-red5/20 pt-3">
              <CountdownUnit value={countdown.days} label="days" />
              <span className="mb-4 text-xl text-red5 font-jersey10">:</span>
              <CountdownUnit value={countdown.hours} label="hrs" />
              <span className="mb-4 text-xl text-red5 font-jersey10">:</span>
              <CountdownUnit value={countdown.minutes} label="min" />
              <span className="mb-4 text-xl text-red5 font-jersey10">:</span>
              <CountdownUnit value={countdown.seconds} label="sec" />
            </div>
          </div>
        </div>

        {emailVerified === false && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="text-sm font-poppins font-semibold text-gray-800">Verify your email</p>
              <p className="mt-0.5 text-xs text-gray-500 font-poppins">
                We sent a link to <span className="font-medium text-gray-700">{userEmail}</span>. Verify to secure your account and receive hackathon updates.
              </p>
            </div>
            <button
              onClick={handleVerifyEmail}
              disabled={resending}
              className="ml-4 shrink-0 rounded-lg bg-red5 px-5 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3 disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend Email"}
            </button>
          </div>
        )}
        {emailVerified === true && (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-6 py-3 shadow-sm">
            <span className="text-lg font-bold text-green-600">✓</span>
            <p className="text-sm font-poppins font-medium text-green-700">Email verified — you're all set.</p>
          </div>
        )}

        <div className="rounded-xl border border-red7 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-poppins font-semibold text-gray-800">Profile Completion</p>
            <span className="text-sm font-poppins font-bold text-red6">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-red7">
            <div className="h-full rounded-full bg-red5 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {missing.length > 0 && (
            <p className="mt-2 text-xs text-gray-400 font-poppins">
              Missing: {missing.slice(0, 4).join(", ")}{missing.length > 4 ? ` +${missing.length - 4} more` : ""}
            </p>
          )}
          {pct < 100 && (
            <button
              onClick={() => navigate("/profile")}
              className="mt-2 text-sm font-poppins font-semibold text-red5 transition-colors hover:text-red6"
            >
              Complete profile →
            </button>
          )}
        </div>

        <div className="rounded-xl border border-red7 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-poppins font-semibold uppercase tracking-widest text-gray-400">
                Forms & Applications
              </p>
              <p className="mt-1 text-sm text-gray-500 font-poppins">
                Active forms are listed here so you can start, revisit, or update each workflow.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {applicationCards.length === 0 && (
              <div className="rounded-lg border border-dashed border-red6/20 bg-red7/20 px-4 py-5">
                <p className="font-poppins text-sm text-gray-500">No active forms are available right now.</p>
              </div>
            )}

            {registrationCard && (
              <button
                onClick={() => openCard(registrationCard)}
                className="flex flex-col items-start gap-3 rounded-lg border border-red6/20 bg-red7/20 px-4 py-5 text-left transition-colors hover:bg-red7/40"
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <p className="font-poppins font-semibold text-gray-900">{registrationCard.title}</p>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-poppins font-semibold uppercase tracking-widest ${registrationTone.badge}`}>
                    {registrationCard.stateLabel}
                  </span>
                </div>
                <p className="text-sm text-gray-600 font-poppins">
                  {registrationCard.description || "Main hackathon application."}
                </p>
                <span className="text-sm font-poppins font-semibold text-red5">
                  {registrationCard.primaryActionLabel} →
                </span>
              </button>
            )}

            {visibleCards.map((card) => {
              const tone = getStatusTone(card);
              return (
                <button
                  key={card.key}
                  onClick={() => openCard(card)}
                  className="flex flex-col items-start gap-3 rounded-lg border border-red6/20 bg-white px-4 py-5 text-left transition-colors hover:bg-red7/20"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <p className="font-poppins font-semibold text-gray-900">{card.title}</p>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-poppins font-semibold uppercase tracking-widest ${tone.badge}`}>
                      {card.stateLabel}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 font-poppins">
                    {card.description || "Additional event workflow."}
                  </p>
                  <span className="text-sm font-poppins font-semibold text-red5">
                    {card.primaryActionLabel} →
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative group">
          <div className="flex flex-col items-center">
            <button
              onClick={() => registrationCard && setPanelOpen(true)}
              disabled={!registrationCard}
              className="relative w-full cursor-pointer overflow-hidden rounded-xl shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Open application form"
            >
              <img
                src={siteBanner}
                alt="BigRed//Hacks — click to apply"
                className="w-full rounded-xl object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
                <span className="rounded-xl bg-red5 px-8 py-3 text-lg font-bold text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100 font-poppins">
                  {registrationCard ? `${registrationCard.primaryActionLabel} →` : "Application Unavailable"}
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 rounded-xl bg-red7 px-10 py-8 shadow-sm">
          <img src={arcade} alt="arcade machine" className="w-56 drop-shadow-lg" />
          <p className="select-none text-8xl leading-tight text-purple9 font-jersey10">
            Hack
            <br />
            On!
          </p>
        </div>
      </div>

      <ApplicationPanel
        isOpen={panelOpen}
        onClose={handlePanelClose}
        onSubmitted={(registration: ApplicationRegistration) => {
          setRegistrations((prev) => {
            const next = prev.filter((row) => (row.form_key ?? "registration") !== "registration");
            return [
              {
                id: registration.id,
                form_key: registration.form_key ?? "registration",
                status: registration.status ?? "pending",
              },
              ...next,
            ];
          });
          setPanelOpen(false);
          if (location.pathname === "/register") {
            navigate("/dashboard");
          }
          showToast(
            registration.status ? `Application ${registration.status}.` : "Application saved.",
            "success",
          );
        }}
      />
    </RegistrationLayout>
  );
};

export default Dashboard;
