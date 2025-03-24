import LoginForm from "../../components/Auth/LoginForm";
import RegisterForm from "../../components/Auth/RegisterForm";
import AuthSwitch from "../../components/Auth/AuthSwitch";

export default function AuthPage() {
  return (
    <div className="h-screen flex items-center justify-center ">
      <div className="bg-off-white p-8 rounded-lg shadow-md w-full max-w-md max-h-[90vh] overflow-y-hidden">
        <AuthSwitch loginForm={<LoginForm />} registerForm={<RegisterForm />} />
      </div>
    </div>
  );
}
