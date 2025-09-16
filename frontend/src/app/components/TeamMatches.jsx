'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TeamMatches({ poolId = 'default' }) {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [draggingMember, setDraggingMember] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchTeams = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/teams?size=4&poolId=${poolId}`);
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

    const handleDragStart = (member, teamIndex) => {
        setDraggingMember({ member, teamIndex });
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, targetMember, targetTeamIndex) => {
        e.preventDefault();
        if (!draggingMember) return;

        const { member: sourceMember, teamIndex: sourceTeamIndex } = draggingMember;

        setTeams(prevTeams => {
            const newTeams = [...prevTeams];
            const sourceTeam = [...newTeams[sourceTeamIndex].members];
            const targetTeam = [...newTeams[targetTeamIndex].members];

            const sourceMemberIndex = sourceTeam.findIndex(m => m.id === sourceMember.id);
            const targetMemberIndex = targetTeam.findIndex(m => m.id === targetMember.id);

            // Swap members
            [sourceTeam[sourceMemberIndex], targetTeam[targetMemberIndex]] = 
            [targetTeam[targetMemberIndex], sourceTeam[sourceMemberIndex]];

            newTeams[sourceTeamIndex] = { ...newTeams[sourceTeamIndex], members: sourceTeam };
            newTeams[targetTeamIndex] = { ...newTeams[targetTeamIndex], members: targetTeam };

            return newTeams;
        });

        setDraggingMember(null);
    };

    const handleSaveTeams = async () => {
        setSaving(true);
        try {
            const response = await fetch('http://localhost:5000/api/teams/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ teams, poolId })
            });

            if (!response.ok) {
                throw new Error('Failed to save teams');
            }

            // Show success message or notification
            alert('Teams saved successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save teams');
        } finally {
            setSaving(false);
        }
    };

    const getTopPreferences = (member) => {
        const preferences = [
            { role: 'Frontend', value: member.frontendPreference },
            { role: 'Backend', value: member.backendPreference },
            { role: 'Design', value: member.designPreference },
            { role: 'Hardware', value: member.hardwarePreference },
            { role: 'Any', value: member.anyRolePreference }
        ];
        return preferences
            .sort((a, b) => b.value - a.value)
            .slice(0, 2)
            .map(p => `${p.role}(${p.value})`)
            .join(', ');
    };

    const getAllSkills = (member) => {
        return [
            ...member.frontendSkills || [],
            ...member.backendSkills || [],
            ...member.designSkills || [],
            ...member.hardwareSkills || []
        ];
    };

    return (
        <div className="max-w-7xl mx-auto p-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    {/* <CardTitle>Team Matches</CardTitle> */}
                    <div className="flex gap-2">
                        <Button onClick={fetchTeams} disabled={loading}>
                            {loading ? 'Generating...' : 'Generate Teams'}
                        </Button>
                        <Button 
                            onClick={handleSaveTeams} 
                            disabled={saving || teams.length === 0}
                            variant="outline"
                        >
                            {saving ? 'Saving...' : 'Save Teams'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="text-red-500 mb-4">{error}</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {teams.map((team, teamIndex) => (
                            <Card key={teamIndex} className="p-4">
                                <h3 className="font-medium mb-2">Team {team.teamNumber || teamIndex + 1}</h3>
                                <div className="space-y-4">
                                    {team.members.map((member) => (
                                        <div
                                            key={member.id}
                                            draggable
                                            onDragStart={() => handleDragStart(member, teamIndex)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, member, teamIndex)}
                                            className="border-b pb-2 cursor-move hover:bg-secondary/10 rounded-lg p-2"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium">{member.fullName}</p>
                                                <span className={`text-xs px-2 py-1 rounded ${member.hackerType === 'FirstTimeHacker' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {member.hackerType === 'FirstTimeHacker' ? 'First Timer' : 'Veteran'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600">NetID: {member.netId}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Top Preferences: {getTopPreferences(member)}
                                            </p>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Experience: F:{member.frontendExperience?.[0]} B:{member.backendExperience?.[0]} D:{member.designExperience?.[0]} H:{member.hardwareExperience?.[0]}
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {getAllSkills(member).slice(0, 5).map((skill, idx) => (
                                                    <span 
                                                        key={idx}
                                                        className="text-xs bg-secondary px-2 py-1 rounded"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                                {getAllSkills(member).length > 5 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{getAllSkills(member).length - 5} more
                                                    </span>
                                                )}
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