import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export default function SuggestionCard({ suggestion, onDelete }) {
    const handleReject = async () => {
        onDelete(suggestion.id);
    };

    const getTopPreferences = () => {
        const preferences = [
            { role: 'Frontend', value: suggestion.frontendPreference },
            { role: 'Backend', value: suggestion.backendPreference },
            { role: 'Design', value: suggestion.designPreference },
            { role: 'Hardware', value: suggestion.hardwarePreference },
            { role: 'Any', value: suggestion.anyRolePreference }
        ];
        return preferences
            .sort((a, b) => b.value - a.value)
            .slice(0, 2)
            .map(p => `${p.role}(${p.value})`)
            .join(', ');
    };

    const getAllSkills = () => {
        return [
            ...suggestion.frontendSkills || [],
            ...suggestion.backendSkills || [],
            ...suggestion.designSkills || [],
            ...suggestion.hardwareSkills || []
        ];
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{suggestion.fullName}</CardTitle>
                <p className="text-sm text-gray-600">{suggestion.email}</p>
                <p className="text-sm text-gray-600">NetID: {suggestion.netId}</p>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="text-xs">
                        <span className={`px-2 py-1 rounded ${suggestion.hackerType === 'FirstTimeHacker' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {suggestion.hackerType === 'FirstTimeHacker' ? 'First Timer' : 'Veteran'}
                        </span>
                    </div>
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <div 
                                className="flex rounded-md border border-input px-2 py-2 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            >
                                Skills & Experience
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-medium mb-1">Experience Levels:</h4>
                                    <div className="grid grid-cols-2 gap-1 text-sm">
                                        <div>Frontend: {suggestion.frontendExperience}</div>
                                        <div>Backend: {suggestion.backendExperience}</div>
                                        <div>Design: {suggestion.designExperience}</div>
                                        <div>Hardware: {suggestion.hardwareExperience}</div>
                                    </div>
                                </div>
                                
                                {getAllSkills().length > 0 && (
                                    <div>
                                        <h4 className="font-medium mb-1">Skills:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {getAllSkills().map((skill, index) => (
                                                <span 
                                                    key={index}
                                                    className="text-xs bg-secondary px-2 py-1 rounded"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <p className="text-xs">{getTopPreferences()}</p>
                <Button 
                    variant="destructive" 
                    onClick={handleReject}
                    size="sm"
                >
                    Reject
                </Button>
            </CardFooter>
        </Card>
    )
}


    