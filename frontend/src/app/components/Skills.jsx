'use client';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const skillCategories = {
    "Frontend Development": [
        "Angular", "React", "Next.js", "Vue.js", "Bootstrap", "Tailwind CSS", "Parcel", "SvelteKit", "Streamlit"
    ],
    "UI Libraries": [
        "Shadcn UI", "Cult UI", "Magic UI",
    ],
    "Backend Development": [
        "Express.js", "FastAPI", "Flask", "Firebase Functions", "Manifest", "Hasura", "ASP.NET", "Spring Boot", "Django", "Node.js"
    ],
    "Mobile Development": [
        "React Native", "Flutter", "Electron", "Ionic",
    ],
    "Database & Storage": [
        "Firestore", "Supabase", "MongoDB", "PlanetScale", "Airtable", "PostgreSQL", "SQLite"
    ],
    "Authentication & Authorization": [
        "Firebase Auth", "Auth0", "Clerk.dev", "Magic Link", "SuperTokens", "NextAuth.js"
    ],
    "AI & ML": [
        "Hugging Face", "Teachable Machine", "Google Colab", 
        "OpenCV", "TensorFlow/PyTorch"
    ],
    "Data Engineering & Big Data": [
        "Google BigQuery Sandbox", "Apache Kafka", "Looker Studio", 
        "Fivetran", "Pandas", "Kaggle"
    ],
    "Cybersecurity": [
        "Nuclei", "OWASP ZAP", "Burp Suite", "Metasploit", "Wireshark", 
    ],
    "Design Tools": [
        "Figma", "Blender", "Pixilart", "v0", "Canva", "Adobe Express", 
    ]
};

export default function Skills({ selectedSkills, onSkillToggle, onClose }) {
    const [searchTerm, setSearchTerm] = useState("");

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredCategories = Object.entries(skillCategories).reduce((acc, [category, skills]) => {
        const filteredSkills = skills.filter(skill => 
            skill.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (filteredSkills.length > 0) {
            acc[category] = filteredSkills;
        }
        return acc;
    }, {});

    return (
        <div onClick={(e) => e.preventDefault()}>
            <Card className="w-full h-[600px] flex flex-col" role="presentation">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle>Select Skills</CardTitle>
                    <Button type="button" variant="ghost" onClick={onClose}>×</Button>
                </CardHeader>    

                <div className="px-6">
                <Input
                        placeholder="Search skills..."
                        value={searchTerm || ""}
                        onChange={handleSearchChange}
                />
                </div>    

                <CardContent className="flex-1 overflow-hidden">
                    <ScrollArea className="h-[460px] pr-4">
                        {Object.entries(filteredCategories).map(([category, skills]) => (
                            <div key={category} className="mb-6">
                                <h3 className="text-lg font-medium mb-2">{category}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {skills.map((skill) => (
                                        <Button
                                            key={skill}
                                            type="button"
                                            variant={selectedSkills.includes(skill) ? "default" : "outline"}
                                            onClick={() => onSkillToggle(skill)}
                                            className="justify-start h-auto py-2 px-4 whitespace-normal text-left"
                                        >
                                            {skill}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}