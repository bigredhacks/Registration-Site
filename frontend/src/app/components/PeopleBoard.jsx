'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import SuggestionCard from './SuggestionCard';

export default function PeopleBoard({ refreshTrigger }) {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleDelete = useCallback(async (id) => {
        try {
            const response = await fetch(`http://localhost:5000/api/submissions/${id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete submission');
            }
            
            setSubmissions(prev => prev.filter(submission => submission._id !== id));
        } catch (error) {
            console.error('Error deleting submission:', error);
        }
    }, []);

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/submissions');
                if (!response.ok) {
                    throw new Error('Failed to fetch submissions');
                }
                const data = await response.json();
                setSubmissions(data.data);
            } catch (error) {
                console.error('Error fetching submissions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSubmissions();
    }, [refreshTrigger]);

    if (loading) {
        return <div>Loading submissions...</div>;
    }

    return (
        <Card className="w-full h-[calc(100vh-2rem)] overflow-y-auto p-4 shadow-xl rounded-xl bg-white border-2 border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 pb-4">
                <CardTitle>People Board</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {submissions.map((submission) => (
                    <SuggestionCard 
                        key={submission._id}
                        suggestion={submission}
                        onDelete={handleDelete}
                    />
                ))}
            </div>
        </Card>
    );
}