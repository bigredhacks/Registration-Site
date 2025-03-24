import InputField from "../Form/InputField";

export default function RegisterForm() {
  return (
    <form className="space-y-8 w-full flex flex-col items-center">
      <div className="w-8/12 space-y-3">
        {/* First Name */}
        <InputField label="First Name" placeholder="First Name" required />

        {/* Last Name */}
        <InputField label="Last Name" placeholder="Last Name" required />

        {/* Email */}
        <InputField label="Email" placeholder="Email" required />

        {/* Password */}
        <InputField
          label="New Password"
          type="password"
          placeholder="Password"
          required
        />

        {/* Confirm Password */}
        <InputField
          label="Confirm Password"
          type="password"
          placeholder="Password"
          required
        />
      </div>
      {/* Submit Button (Now properly spaced) */}
      <div className="w-9/12">
        <button
          type="submit"
          className="w-full py-1 rounded-md shadow-sm text-normal font-medium text-white bg-red-medium hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Create Account
        </button>
      </div>
    </form>
  );
}
