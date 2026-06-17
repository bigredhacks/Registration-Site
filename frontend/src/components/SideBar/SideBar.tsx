import { memo } from "react";
import SideButtonSet from "./SideButtonSet";
import logo from "@/assets/brh_logo_sidebar.png";

const Sidebar = memo(() => {
  return (
    <aside className="w-56 h-screen bg-red5 rounded-r-lg flex flex-col p-6 fixed left-0 top-0 z-40">
      <div className="mb-7">
        <img 
          src={logo} 
          alt="Logo" 
          className="w-36 mx-auto mb-4"
          loading="eager"
        />
      </div>

      <nav className="flex-1 space-y-2">
        <SideButtonSet />
      </nav>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
