import InputField from "../Form/InputField";

export default function LoginForm() {
  return (
    <form className="space-y-4 w-full flex flex-col items-center">
      <div className="w-8/12 space-y-3">
        {/* Email */}
        <InputField label="Email" placeholder="Email" required />
        {/* Password */}
        <InputField
          label="Password"
          type="password"
          placeholder="Password"
          required
        />
      </div>

      {/* Forget Password */}
      <div className="flex items-center justify-center">
        <a
          href="" // TODO: Redirect to Forgot Password page
          className="text-xs font-light underline text-brown-light hover:text-brown-dark"
        >
          Forget Password?
        </a>
      </div>

      {/* Submit */}
      <div className="w-10/12 flex justify-center">
        <button
          type="submit"
          className="w-full py-1 rounded-md shadow-sm text-normal font-medium text-white bg-red-medium hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Login
        </button>
      </div>
    </form>
  );
}
