'use client';
import Image from 'next/image'
import Form from '../app/components/Form'
import PeopleBoard from './components/PeopleBoard';
import { useState } from 'react';
import TeamMatches from './components/TeamMatches';
export default function Home() {

const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleFormSubmit = () => {
      setRefreshTrigger(prev => prev + 1);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Form onSubmitSuccess={handleFormSubmit} />
      <PeopleBoard refreshTrigger={refreshTrigger} />
      <TeamMatches />
    </main>
  )
}
