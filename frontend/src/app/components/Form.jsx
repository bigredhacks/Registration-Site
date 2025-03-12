'use client';
import { useState } from 'react';

export default function Form() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        skills: [],
        roles: ['Designer', 'Frontend', 'Backend']
    });
    const [skillInput, setSkillInput] = useState('');
    const [submissions, setSubmissions] = useState([]);
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
            
            const data = await response.json();
            setSubmissions(prev => [...prev, data.data]);
            
            // Reset form
            setFormData({
                name: '',
                email: '',
                phone: '',
                skills: [],
                roles: ['Designer', 'Frontend', 'Backend']
            });
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <form onSubmit={handleSubmit}>
                <div className="card">
                    <div className="card-header">
                        <h1 className="card-title">Team Matcher</h1>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Contact Information</h3>
                            <div className="space-y-2">
                                <label className="form-label">Name</label>
                                <input
                                    className="form-input text-black"
                                    name="name"
                                    placeholder="Name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="form-label">Email</label>
                                <input
                                    className="form-input text-black"
                                    name="email"
                                    type="email"
                                    placeholder="Email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="form-label">Phone</label>
                                <input
                                    className="form-input text-black"
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
                                {formData.roles.map((role, index) => (
                                    <li
                                        key={role}
                                        draggable
                                        onDragStart={() => handleDragStart(role)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, role)}
                                        className="draggable-item"
                                    >
                                        {role}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Skills</h3>
                            <div className="flex gap-2">
                                <input
                                    className="form-input text-black"
                                    type="text"
                                    placeholder="Add a skill"
                                    value={skillInput}
                                    onChange={(e) => setSkillInput(e.target.value)}
                                />
                                <button type="button" className="btn btn-primary" onClick={handleSkillAdd}>
                                    Add Skill
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {formData.skills.map((skill, index) => (
                                    <li key={index} className="skill-item">
                                        <span>{skill}</span>
                                        <button
                                            type="button"
                                            className="btn btn-destructive btn-sm"
                                            onClick={() => handleSkillRemove(index)}
                                        >
                                            X
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button type="submit" className="btn btn-primary w-full">
                            Submit
                        </button>
                    </div>
                </div>
            </form>

            {submissions.length > 0 && (
                <div className="card mt-6">
                    <div className="card-header">
                        <h2 className="card-title">Submissions</h2>
                    </div>
                    <div className="space-y-4">
                        {submissions.map((submission, index) => (
                            <div key={index} className="pb-4 border-b last:border-b-0">
                                <h3 className="font-medium">{submission.name}</h3>
                                <p>Email: {submission.email}</p>
                                <p>Phone: {submission.phone}</p>
                                <p>Roles: {submission.roles.join(' > ')}</p>
                                <p>Skills: {submission.skills.join(', ')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}