import { ReactNode, memo } from 'react';
import Sidebar from '../SideBar/SideBar';

interface RegistrationLayoutProps {
  children: ReactNode;
  className?: string;
}

const RegistrationLayout = memo(({ children, className = '' }: RegistrationLayoutProps) => {
  return (
    <div className={`flex min-h-dvh flex-col bg-white lg:flex-row ${className}`}>
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:ml-56 lg:p-8">
        {children}
      </main>
    </div>
  );
});

RegistrationLayout.displayName = 'RegistrationLayout';

export default RegistrationLayout;
