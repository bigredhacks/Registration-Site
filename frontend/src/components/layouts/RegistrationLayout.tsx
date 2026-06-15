import { ReactNode, memo } from 'react';
import Sidebar from '../SideBar/SideBar';

interface RegistrationLayoutProps {
  children: ReactNode;
  className?: string;
}

const RegistrationLayout = memo(({ children, className = '' }: RegistrationLayoutProps) => {
  return (
    <div className={`flex min-h-screen bg-white ${className}`}>
      <Sidebar />
      <main className="ml-56 flex-1 p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
});

RegistrationLayout.displayName = 'RegistrationLayout';

export default RegistrationLayout;