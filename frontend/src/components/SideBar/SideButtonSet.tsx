import { useNavigate } from "react-router-dom";
import SideButton from "./SideButton";
import { ICONS } from "../../constants/icons";
import { supabase } from "../../config/supabase";
import { useAdmin } from "@/lib/useAdmin";

const SideButtonSet = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  const handleLogout = async () => {
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
      {isAdmin && (
        <SideButton
          to="/admin"
          iconElement={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
            </svg>
          }
        >
          Admin
        </SideButton>
      )}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 h-12 font-medium rounded-lg transition-colors duration-200 text-white hover:bg-red4 w-full"
      >
        {ICONS.logout && (
          <img
            src={ICONS.logout}
            alt=""
            className="w-7 transition-opacity duration-200"
            loading="eager"
          />
        )}
        <span className="font-poppins transition-colors duration-200">Logout</span>
      </button>
    </>
  );
};

export default SideButtonSet;
