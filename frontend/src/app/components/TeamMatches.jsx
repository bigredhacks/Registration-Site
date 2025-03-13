'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TeamMatches() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTeams = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:5000/api/teams?size=4');
            if (!response.ok) {
                throw new Error('Failed to fetch teams');
            }
            const data = await response.json();
            setTeams(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch teams');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Team Matches</CardTitle>
                    <Button onClick={fetchTeams} disabled={loading}>
                        {loading ? 'Generating...' : 'Generate Teams'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="text-red-500 mb-4">{error}</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {teams.map((team, index) => (
                            <Card key={index} className="p-4">
                                <h3 className="font-medium mb-2">Team {index + 1}</h3>
                                <div className="space-y-4">
                                    {team.map((member) => (
                                        <div key={member._id} className="border-b pb-2">
                                            <p className="font-medium">{member.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Preferred Roles: {member.roles.join(' > ')}
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {member.skills.map((skill, idx) => (
                                                    <span 
                                                        key={idx}
                                                        className="text-xs bg-secondary px-2 py-1 rounded"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}