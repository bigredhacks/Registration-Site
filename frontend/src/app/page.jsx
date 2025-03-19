'use client';
import { useState } from 'react';
import Form from './components/Form';
import PeopleBoard from './components/PeopleBoard';

export default function Home() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleFormSubmit = () => {
        setRefreshTrigger(prev => prev + 1);
    };
    
    return (
        <main className="container mx-auto py-6 space-y-8">
            <Form onSubmitSuccess={handleFormSubmit} />
            <PeopleBoard refreshTrigger={refreshTrigger} />
        </main>
    );
}