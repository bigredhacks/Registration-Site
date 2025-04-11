'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from '@/components/ui/checkbox';
import Skills from "./Skills";
import { useToast } from "@/components/ui/use-toast"

const ALL_ROLES = ['Designer', 'Frontend', 'Backend', 'Any'];

export default function Form({ onSubmitSuccess }) {
  const { toast } = useToast();
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  
  const handleSkillToggle = (skill) => {
    setSelectedSkills(prev => {
      const newSkills = prev.includes(skill) 
        ? prev.filter(s => s !== skill)
        : [...prev, skill];
      
      setFormData(prevForm => ({
        ...prevForm,
        skills: newSkills
      }));
      
      return newSkills;
    });
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    skills: [], // This will now be updated when selectedSkills changes
    roles: ['Designer', 'Frontend', 'Backend', 'Any'],
    firstTimeHacker: false
  });
    const [draggingItem, setDraggingItem] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCheckboxChange = (checked) => {
        setFormData(prev => ({
            ...prev,
            firstTimeHacker: checked
        }))
    }

    const handleRoleRemove = (roleToRemove) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.filter(role => role !== roleToRemove)
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

    const handleAddRole = (role) => {
      if (!formData.roles.includes(role)) {
        setFormData(prev => ({
          ...prev,
          roles: [...prev.roles, role]
        }));
      }
    };

    const renderRolesList = () => {
      const availableRoles = ALL_ROLES.filter(role => !formData.roles.includes(role));
      
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Role Preferences (Drag)</h3>
          <ul className="space-y-2">
            {formData.roles.map((role) => (
              <li
                key={role}
                draggable
                onDragStart={() => handleDragStart(role)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, role)}
                className="p-3 bg-secondary rounded-lg cursor-move hover:bg-secondary/80 flex items-center justify-between"
              >
                <span>{role}</span>
                <Button 
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRoleRemove(role)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
          {availableRoles.length > 0 && (
            <select
              className="w-full p-2 rounded-md border border-input bg-transparent text-sm"
              onChange={(e) => {
                if (e.target.value) {
                  handleAddRole(e.target.value);
                  e.target.value = '';
                }
              }}
              value=""
            >
              <option value="">Add role...</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          )}
        </div>
      );
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
            
            // Reset form and show success toast
            setFormData({
                name: '',
                email: '',
                phone: '',
                skills: [],
                roles: ['Designer', 'Frontend', 'Backend', 'Any'],
                firstTimeHacker: false
            });
            
            toast({
                title: "Success!",
                description: "Your form has been submitted successfully.",
                className: "bg-white border-green-500 text-green-800",
            });
            
            onSubmitSuccess?.();
        } catch (error) {
            console.error('Error submitting form:', error);
            toast({
                variant: "default",
                title: "Submission Failed",
                description: "Unable to submit form. Please try again.",
                className: "bg-white border-red-500 text-red-800",
            });
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
                            {renderRolesList()}
                        </div>
                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => setIsSkillsOpen(true)}
                                >
                                    {selectedSkills.length > 0 
                                    ? `Selected ${selectedSkills.length} skills`
                                    : "Select skills..."}
                                </Button>
                                
                                {isSkillsOpen && (
                                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
                                <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]">
                                    <Skills
                                    selectedSkills={selectedSkills}
                                    onSkillToggle={handleSkillToggle}
                                    onClose={() => setIsSkillsOpen(false)}
                                    />
                                </div>
                                </div>
                            )}
                            </div>
                        <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="firstTimeHacker"
                            checked={formData.firstTimeHacker}
                            onCheckedChange={handleCheckboxChange}
                        />
                        <label
                            htmlFor="firstTimeHacker"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            First Time Hacker?
                        </label>
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
