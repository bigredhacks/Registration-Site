import { useNavigate } from "react-router-dom";
import SideButton from "./SideButton";
import { ICONS } from "../../constants/icons";
import { supabase } from "../../config/supabase";
import { useApplicantPreview } from "@/lib/ApplicantPreviewContext";

const SideButtonSet = () => {
  const navigate = useNavigate();
  const preview = useApplicantPreview();

  const handleLogout = async () => {
    if (import.meta.env.DEV && preview) {
      window.location.assign('/dashboard');
      return;
    }
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <SideButton
        to="/dashboard"
        icon={ICONS.dashboard}
        activeIcon={ICONS.activeDashboard}
      >
        Dashboard
      </SideButton>
      <SideButton
        to="/profile"
        icon={ICONS.profile}
        activeIcon={ICONS.activeProfile}
      >
        Profile
      </SideButton>
      <SideButton
        to="/register"
        icon={ICONS.register}
        activeIcon={ICONS.activeRegister}
      >
        Register
      </SideButton>
      <SideButton
        to="/team"
        icon={ICONS.team}
        activeIcon={ICONS.activeTeam}
      >
        Team
      </SideButton>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-2 h-12 text-sm lg:gap-3 lg:px-4 lg:text-base font-medium rounded-lg transition-colors duration-200 text-white hover:bg-red4 w-full"
      >
        {ICONS.logout && (
          <img
            src={ICONS.logout}
            alt=""
            className="w-6 shrink-0 lg:w-7 transition-opacity duration-200"
            loading="eager"
          />
        )}
        <span className="font-poppins transition-colors duration-200">Logout</span>
      </button>
    </>
  );
};

export default SideButtonSet;
