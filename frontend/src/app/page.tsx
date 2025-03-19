'use client';
import { useState } from 'react';
import Form from './components/Form';
import PeopleBoard from './components/PeopleBoard';
import TeamMatches from './components/TeamMatches';
import AdminLogin from './components/AdminLogin';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Button } from "@/components/ui/button";

function MainContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { isAdmin, logout } = useAuth();

  const handleFormSubmit = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (isAdmin) {
    return (
      <div className="min-h-screen p-6">
        <div className="flex justify-end mb-4">
          <Button variant="ghost" className='font-black' onClick={logout}>Logout</Button>
        </div>
        <div className="space-y-6">
          <PeopleBoard refreshTrigger={refreshTrigger} />
          <TeamMatches />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="absolute top-4 right-4">
        <AdminLogin />
      </div>
      <div className="w-full max-w-xl p-6">
        <Form onSubmitSuccess={handleFormSubmit} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
