import { useEffect, useState } from "react";
import RegistrationLayout from "../../components/layouts/RegistrationLayout";
import { useToast } from "../../components/Toast/ToastContext";
import { supabase } from "../../config/supabase";
import SearchableCombobox from "../../components/SearchableCombobox";
import {
  AGE_RANGES,
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
  MAJOR_SUGGESTIONS,
  profileSchema,
  SCHOOLS_CSV_URL,
  SHIRT_SIZES,
} from "../../lib/formConfig";
import { apiFetch } from "../../lib/api";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  age: string;
  graduationYear: string;
  university: string;
  major: string;
  gender: string;
  dietaryRestrictions: string[];
  shirtSize: string;
}

const STORAGE_KEY = "brh_profile";

const inputCls =
  "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-red5 transition-colors font-poppins";
const selectCls =
  "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red5 transition-colors appearance-none cursor-pointer pr-8 font-poppins";

const Chevron = () => (
  <svg
    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const Field = ({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm text-gray-600 font-poppins font-medium">
      {label}
      {required && <span className="text-red5 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

const SectionHeader = ({ title }: { title: string }) => (
  <div className="col-span-full">
    <h2 className="text-base font-poppins font-semibold text-red6 mb-1">{title}</h2>
    <div className="h-px bg-red7 w-full" />
  </div>
);

const Profile = () => {
  const { showToast } = useToast();

  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", email: "", phoneNumber: "",
    age: "", graduationYear: "", university: "", major: "",
    gender: "", dietaryRestrictions: [], shirtSize: "",
  });

  const [emailVerified, setEmailVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Load from localStorage + Supabase auth email on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setForm((prev) => ({ ...prev, ...parsed }));
      } catch { /* ignore */ }
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setForm((prev) => ({ ...prev, email: prev.email || data.user!.email! }));
      }
    });
  }, []);

  const clearFieldError = (field: keyof FormData) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const toggleDietary = (option: string) => {
    setForm((prev) => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(option)
        ? prev.dietaryRestrictions.filter((d) => d !== option)
        : [...prev.dietaryRestrictions, option],
    }));
    clearFieldError("dietaryRestrictions");
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    let formatted = "";
    if (digits.length > 0) formatted = `(${digits.slice(0, 3)}`;
    if (digits.length >= 4) formatted += `) ${digits.slice(3, 6)}`;
    if (digits.length >= 7) formatted += `-${digits.slice(6, 10)}`;
    handleChange("phoneNumber", formatted);
  };

  const handleSave = async () => {
    const result = profileSchema.safeParse(form);
    if (!result.success) {
      const newErrors: Partial<Record<keyof FormData, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormData;
        if (field && !newErrors[field]) newErrors[field] = issue.message;
      }
      setErrors(newErrors);
      showToast("Please fix the highlighted fields.", "error");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      await apiFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: `${form.firstName} ${form.lastName}`.trim() }),
      });
      showToast("Profile saved!", "success");
    } catch {
      showToast("Failed to save profile. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RegistrationLayout>
      <div className="h-full px-1">
        <div className="mb-6">
          <h1 className="text-3xl font-poppins font-bold text-red6">Profile</h1>
          <p className="text-sm font-poppins text-gray-500 mt-1">
            Keep your profile up to date — it will pre-fill your hackathon application.
          </p>
        </div>

        <div className="bg-red7 rounded-2xl p-8 w-full">
          <div className="grid grid-cols-3 gap-x-6 gap-y-5">

            {/* Personal Info */}
            <SectionHeader title="Personal Info" />

            <Field label="First Name" required error={errors.firstName}>
              <input
                type="text" placeholder="First Name"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Last Name" required error={errors.lastName}>
              <input
                type="text" placeholder="Last Name"
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Email" required error={errors.email}>
              <div className="flex gap-2">
                <input
                  type="email" placeholder="bigredhacks@gmail.com"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => setEmailVerified(true)}
                  className={`px-3 py-2 rounded-lg text-white text-sm font-poppins font-semibold whitespace-nowrap transition-colors ${
                    emailVerified ? "bg-green-500" : "bg-red5 hover:bg-red3"
                  }`}
                >
                  {emailVerified ? "✓ Verified" : "Verify"}
                </button>
              </div>
            </Field>

            <Field label="Phone Number" required error={errors.phoneNumber}>
              <input
                type="tel" placeholder="(___) ___-____"
                value={form.phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={inputCls}
              />
            </Field>

            {/* Academic Info */}
            <SectionHeader title="Academic Info" />

            <Field label="Age Range" required error={errors.age}>
              <div className="relative">
                <select
                  value={form.age}
                  onChange={(e) => handleChange("age", e.target.value)}
                  className={`${selectCls} ${!form.age ? "text-gray-400" : "text-gray-800"}`}
                >
                  <option value="" disabled>Select age range</option>
                  {AGE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <Chevron />
              </div>
            </Field>

            <Field label="Graduation Year" required error={errors.graduationYear}>
              <input
                type="number" placeholder="2027"
                value={form.graduationYear}
                onChange={(e) => handleChange("graduationYear", e.target.value)}
                className={inputCls} min={2020} max={2035}
              />
            </Field>

            <Field label="School / University" required error={errors.university}>
              <SearchableCombobox
                value={form.university}
                onChange={(v) => handleChange("university", v)}
                csvUrl={SCHOOLS_CSV_URL}
                placeholder="Search for your school…"
                allowCustomValue
              />
            </Field>

            <Field label="Major / Field of Study">
              <SearchableCombobox
                value={form.major}
                onChange={(v) => handleChange("major", v)}
                staticOptions={[...MAJOR_SUGGESTIONS]}
                placeholder="e.g. Computer Science"
                allowCustomValue
              />
            </Field>

            {/* Preferences */}
            <SectionHeader title="Preferences" />

            <Field label="Gender">
              <div className="relative">
                <select
                  value={form.gender}
                  onChange={(e) => handleChange("gender", e.target.value)}
                  className={`${selectCls} ${!form.gender ? "text-gray-400" : "text-gray-800"}`}
                >
                  <option value="" disabled>Select gender</option>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <Chevron />
              </div>
            </Field>

            <div className="col-span-2">
              <Field label="Dietary Restrictions / Allergies">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1">
                  {DIETARY_OPTIONS.map((option) => {
                    const checked = form.dietaryRestrictions.includes(option);
                    return (
                      <div key={option} className="flex gap-1.5 items-center">
                        <button
                          type="button"
                          onClick={() => toggleDietary(option)}
                          className={`w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                            checked
                              ? "border-[#fe1736] bg-[#fe1736]"
                              : "border-[#e9e9e9] bg-white"
                          }`}
                        >
                          {checked && (
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                        <label
                          onClick={() => toggleDietary(option)}
                          className={`text-sm font-poppins cursor-pointer transition-colors ${
                            checked ? "text-red6 font-semibold" : "text-gray-600"
                          }`}
                        >
                          {option}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </Field>
            </div>

            <div className="col-span-full">
              <Field label="Shirt Size (US sizing)">
                <div className="flex items-center gap-6 mt-1">
                  {SHIRT_SIZES.map((size) => {
                    const selected = form.shirtSize === size;
                    return (
                      <div key={size} className="flex gap-1.5 items-center">
                        <button
                          type="button"
                          onClick={() => handleChange("shirtSize", size)}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center bg-white ${
                            selected ? "border-[#fe1736]" : "border-[#9c9494]"
                          }`}
                        >
                          {selected && <div className="w-3 h-3 rounded-full bg-[#fe1736]" />}
                        </button>
                        <label
                          onClick={() => handleChange("shirtSize", size)}
                          className={`text-sm font-poppins cursor-pointer transition-colors ${
                            selected ? "text-red6 font-semibold" : "text-gray-600"
                          }`}
                        >
                          {size}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </Field>
            </div>

          </div>

          <div className="flex justify-end mt-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-10 py-3 rounded-lg bg-red5 hover:bg-red3 text-white font-poppins font-semibold text-sm transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </RegistrationLayout>
  );
};

export default Profile;
