'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Form({ onSubmitSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        skills: [],
        roles: ['Designer', 'Frontend', 'Backend']
    });
    const [skillInput, setSkillInput] = useState('');
    const [draggingItem, setDraggingItem] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSkillAdd = () => {
        if (skillInput.trim()) {
            setFormData(prev => ({
                ...prev,
                skills: [...prev.skills, skillInput.trim()]
            }));
            setSkillInput('');
        }
    };

    const handleSkillRemove = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            skills: prev.skills.filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleDragStart = (role) => {
        setDraggingItem(role);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, targetRole) => {
        e.preventDefault();
        if (draggingItem) {
            setFormData(prev => {
                const updatedRoles = [...prev.roles];
                const draggingIndex = updatedRoles.indexOf(draggingItem);
                const targetIndex = updatedRoles.indexOf(targetRole);
                [updatedRoles[draggingIndex], updatedRoles[targetIndex]] = [
                    updatedRoles[targetIndex],
                    updatedRoles[draggingIndex],
                ];
                return { ...prev, roles: updatedRoles };
            });
            setDraggingItem(null);
        }
    };

    // In the handleSubmit function
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            // Reset form after successful submission
            setFormData({
                name: '',
                email: '',
                phone: '',
                skills: [],
                roles: ['Designer', 'Frontend', 'Backend']
            });
            
            // Call the callback if provided
            onSubmitSuccess?.();
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Team Matcher</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Contact Information</h3>
                            <div className="space-y-2">
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="Name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="Email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    placeholder="Phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Role Preferences</h3>
                            <ul className="space-y-2">
                                {formData.roles.map((role) => (
                                    <li
                                        key={role}
                                        draggable
                                        onDragStart={() => handleDragStart(role)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, role)}
                                        className="p-3 bg-secondary rounded-lg cursor-move hover:bg-secondary/80"
                                    >
                                        {role}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Skills</h3>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="Add a skill"
                                    value={skillInput}
                                    onChange={(e) => setSkillInput(e.target.value)}
                                />
                                <Button 
                                    type="button" 
                                    onClick={handleSkillAdd}
                                    variant="secondary"
                                >
                                    Add Skill
                                </Button>
                            </div>
                            <ul className="space-y-2">
                                {formData.skills.map((skill, index) => (
                                    <li key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                        <span>{skill}</span>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleSkillRemove(index)}
                                        >
                                            ×
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <Button type="submit" className="w-full">
                            Submit
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
