import { memo, useRef, useState } from "react";
import SideButtonSet from "./SideButtonSet";
import logo from "@/assets/brh_logo_sidebar.png";

const Sidebar = memo(() => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <aside
      className="relative z-40 flex w-full shrink-0 flex-col rounded-b-lg bg-red5 p-4 lg:fixed lg:left-0 lg:top-0 lg:h-dvh lg:w-56 lg:overflow-y-auto lg:rounded-b-none lg:rounded-r-lg lg:p-6"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="flex items-center justify-between gap-4 lg:mb-7 lg:block">
        <img 
          src={logo} 
          alt="BigRed//Hacks"
          className="w-28 lg:mx-auto lg:mb-4 lg:w-36"
          loading="eager"
        />
        <button
          ref={menuButton}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="registration-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-white/40 px-3 font-poppins text-sm font-medium text-white hover:bg-red3 lg:hidden"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={menuOpen ? "M6 6l12 12M6 18L18 6" : "M3 6h18M3 12h18M3 18h18"} />
          </svg>
          {menuOpen ? "Close menu" : "Menu"}
        </button>
      </div>

      <nav
        id="registration-navigation"
        aria-label="Main navigation"
        className={`${menuOpen ? "grid" : "hidden"} mt-4 grid-cols-2 gap-2 lg:mt-0 lg:block lg:flex-1 lg:space-y-2`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a, button")) setMenuOpen(false);
        }}
      >
        <SideButtonSet />
      </nav>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
