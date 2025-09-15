'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle} from "@/components/ui/card";
import SuggestionCard from './SuggestionCard';

export default function PeopleBoard({ refreshTrigger, poolId = 'default' }) {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleDelete = useCallback(async (id) => {
        try {
            const response = await fetch(`http://localhost:5000/api/participants/${id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete participant');
            }
            
            setParticipants(prev => prev.filter(participant => participant.id !== id));
        } catch (error) {
            console.error('Error deleting participant:', error);
        }
    }, []);

    useEffect(() => {
        const fetchParticipants = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/participants?poolId=${poolId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch participants');
                }
                const data = await response.json();
                setParticipants(data.data);
            } catch (error) {
                console.error('Error fetching participants:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchParticipants();
    }, [refreshTrigger, poolId]);

    if (loading) {
        return <div>Loading participants...</div>;
    }

    return (
        <Card className="w-full h-[calc(100vh-2rem)] overflow-y-auto p-4 shadow-xl rounded-xl bg-white border-2 border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 pb-4">
                <CardTitle>People Board</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {participants.map((participant) => (
                    <SuggestionCard 
                        key={participant.id}
                        suggestion={participant}
                        onDelete={handleDelete}
                    />
                ))}
            </div>
        </Card>
    );
}