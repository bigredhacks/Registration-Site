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
        onDelete(suggestion._id);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{suggestion.name}</CardTitle>
                <p>{suggestion.email}</p>
                <p>{suggestion.phone}</p>
            </CardHeader>
            <CardContent>
                <CardDescription>
                    <Popover>
                        <PopoverTrigger>
                            <button className="flex rounded-md border border-input px-4 py-2 font-medium hover:bg-accent hover:text-accent-foreground">
                            Skills
                            </button>
                        </PopoverTrigger>
                        <PopoverContent>
                            {suggestion.skills.map((skill, index) => (
                                <p key={index}>{skill}</p>
                            ))}
                        </PopoverContent>
                    </Popover>
                </CardDescription>
            </CardContent>
            <CardFooter className="flex justify-between">
                <p>{suggestion.roles.join(', ')}</p>
                <Button 
                    variant="destructive" 
                    onClick={handleReject}
                >
                    Reject
                </Button>
            </CardFooter>
        </Card>
    )
}


    