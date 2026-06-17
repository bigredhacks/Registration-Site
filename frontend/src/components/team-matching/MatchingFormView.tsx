import { useState } from "react";
import DynamicForm from "@/components/registration/DynamicForm";
import { teamMatchingFormConfig } from "@/lib/formConfig";

interface MatchingFormViewProps {
  onBack: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function MatchingFormView({ onBack, onSubmit }: MatchingFormViewProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsLoading(true);
    try {
      await onSubmit(data);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-center w-full">
        <h1 className="font-medium text-[28px] text-[#cb4643]">Team</h1>
      </div>

      {/* Form Content */}
      <div className="bg-[#fbebe9] flex flex-col items-center px-5 py-[30px] rounded-lg w-full gap-5">
        {/* Title card */}
        <div className="bg-white flex flex-col gap-2 px-8 py-6 rounded-lg w-full">
          <p className="text-lg font-normal text-black">Team Matching Form</p>
          <p className="text-sm text-[#907960]">
            Fill out this form about yourself. Team matches will be released 1 week before the hackathon.
          </p>
        </div>

        {/* Use DynamicForm with team matching config */}
        <div className="bg-white rounded-lg w-full">
          <DynamicForm
            config={{ ...teamMatchingFormConfig, title: "", description: "" }}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>

      <button onClick={onBack} className="text-[#cb4643] font-medium text-sm">
        Back
      </button>
    </>
  );
}
