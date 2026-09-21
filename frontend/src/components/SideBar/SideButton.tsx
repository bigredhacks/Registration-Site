import React, { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApplicantPreview } from '@/lib/ApplicantPreviewContext';

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
    const preview = useApplicantPreview();
    const isActive = location.pathname === to;
    // The local previews have separate fixture handlers and document entries.
    const previewHref = import.meta.env.DEV && preview && (preview.view === 'admin' || to === '/admin')
      ? `${to === '/admin' ? '/admin-preview.html' : '/applicant-preview.html'}?persona=${encodeURIComponent(preview.personaId)}${to === '/admin' ? '' : `#${to}`}`
      : undefined;
  const buttonProps = {
      'aria-current': isActive ? 'page' as const : undefined,
      className: `flex min-w-0 items-center gap-2 px-2 h-12 text-sm lg:gap-3 lg:px-4 lg:text-base font-medium rounded-lg transition-colors duration-200 ${
        isActive
            ? 'bg-white text-red5'
            : 'text-white hover:bg-red4'
      } ${className || ''}`,
  };
  const content = <>
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
  </>;
  return previewHref
    ? <a href={previewHref} {...buttonProps} onClick={isActive ? event => event.preventDefault() : undefined}>{content}</a>
    : <Link to={to} {...buttonProps}>{content}</Link>;
});

SideButton.displayName = 'SideButton';

export default SideButton;
