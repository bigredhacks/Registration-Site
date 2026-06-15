import React, { memo } from "react";
import { Link, useLocation } from "react-router-dom";

type SideButtonProps = {
    to: string;
    children: React.ReactNode;
    icon?: string;
    activeIcon?: string;
    className?: string;
};

const SideButton: React.FC<SideButtonProps> = memo(({
  to,
  children,
  icon,
  activeIcon,
  className,
}) => {
    const location = useLocation();
    const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 h-12 font-medium rounded-lg transition-colors duration-200 ${
        isActive
            ? 'bg-white text-red5'
            : 'text-white hover:bg-red4'
      } ${className || ''}`}

    >
      {icon && (
        <img
          src={isActive && activeIcon ? activeIcon : icon}
          alt=""
          className="w-7 transition-opacity duration-200"
          loading="eager"
        />
      )}
      <span className="font-poppins transition-colors duration-200">{children}</span>
    </Link>
  );
});

SideButton.displayName = 'SideButton';

export default SideButton;
