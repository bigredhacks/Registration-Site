import React, { memo } from "react";
import { Link, useLocation } from "react-router-dom";

type SideButtonProps = {
    to: string;
    children: React.ReactNode;
    icon?: string;
    activeIcon?: string;
    iconElement?: React.ReactNode;
    className?: string;
};

const SideButton: React.FC<SideButtonProps> = memo(({
  to,
  children,
  icon,
  activeIcon,
  iconElement,
  className,
}) => {
    const location = useLocation();
    const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={`flex min-w-0 items-center gap-2 px-2 h-12 text-sm lg:gap-3 lg:px-4 lg:text-base font-medium rounded-lg transition-colors duration-200 ${
        isActive
            ? 'bg-white text-red5'
            : 'text-white hover:bg-red4'
      } ${className || ''}`}

    >
      {iconElement ? (
        <span className="w-7 flex items-center justify-center">{iconElement}</span>
      ) : icon ? (
        <img
          src={isActive && activeIcon ? activeIcon : icon}
          alt=""
          className="w-6 shrink-0 lg:w-7 transition-opacity duration-200"
          loading="eager"
        />
      ) : null}
      <span className="font-poppins transition-colors duration-200">{children}</span>
    </Link>
  );
});

SideButton.displayName = 'SideButton';

export default SideButton;
