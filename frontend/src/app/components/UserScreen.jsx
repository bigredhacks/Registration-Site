import { GalleryVerticalEnd } from "lucide-react"
import { useState } from 'react';
import Form from "./Form"
import TeamMatches from './TeamMatches'
import PeopleBoard from './PeopleBoard'

export default function LoginPage() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showPeopleBoard, setShowPeopleBoard] = useState(false);

    const handleFormSubmit = () => {
        setRefreshTrigger(prev => prev + 1);
        setShowPeopleBoard(true);
    };

    return (
        <div className="min-h-svh">
            {!showPeopleBoard ? (
                <div className="flex flex-col gap-4 p-6 md:p-10 max-w-xl mx-auto">
                    <div className="flex justify-center gap-2">
                        <a href="#" className="flex items-center gap-2 font-medium">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                                <GalleryVerticalEnd className="size-4" />
                            </div>
                            BigRedHacks
                        </a>
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                        <div className="w-full">
                            <Form onSubmitSuccess={handleFormSubmit} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-6 md:p-10">
                    <div className="flex justify-between items-center mb-6">
                        <a href="#" className="flex items-center gap-2 font-medium">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                                <GalleryVerticalEnd className="size-4" />
                            </div>
                            BigRedHacks
                        </a>
                    </div>
                    <PeopleBoard refreshTrigger={refreshTrigger} />
                </div>
            )}
        </div>
    );
}
