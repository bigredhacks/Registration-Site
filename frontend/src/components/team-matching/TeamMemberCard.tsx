interface TeamMemberCardProps {
  name: string;
  email: string;
  hackerType: string;
  frontendExperience: string;
  backendExperience: string;
  designExperience: string;
  hardwareExperience: string;
  frontendSkills: string[];
  backendSkills: string[];
  designSkills: string[];
  hardwareSkills: string[];
}

const experienceAbbrev: Record<string, string> = {
  Beginner: "Beg",
  Intermediate: "Int",
  Advanced: "Adv",
};

export default function TeamMemberCard({
  name,
  email,
  hackerType,
  frontendExperience,
  backendExperience,
  designExperience,
  hardwareExperience,
  frontendSkills,
  backendSkills,
  designSkills,
  hardwareSkills,
}: TeamMemberCardProps) {
  const allSkills = [
    ...frontendSkills,
    ...backendSkills,
    ...designSkills,
    ...hardwareSkills,
  ].filter(Boolean);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            hackerType === "FirstTimeHacker"
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {hackerType === "FirstTimeHacker" ? "First-timer" : "Veteran"}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{email}</p>
      <div className="flex gap-2 flex-wrap mb-2">
        <span className="text-xs text-gray-600">
          FE: {experienceAbbrev[frontendExperience] ?? frontendExperience}
        </span>
        <span className="text-xs text-gray-600">
          BE: {experienceAbbrev[backendExperience] ?? backendExperience}
        </span>
        <span className="text-xs text-gray-600">
          Des: {experienceAbbrev[designExperience] ?? designExperience}
        </span>
        <span className="text-xs text-gray-600">
          HW: {experienceAbbrev[hardwareExperience] ?? hardwareExperience}
        </span>
      </div>
      {allSkills.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {allSkills.slice(0, 6).map((skill) => (
            <span
              key={skill}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
            >
              {skill}
            </span>
          ))}
          {allSkills.length > 6 && (
            <span className="text-xs text-gray-400">
              +{allSkills.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
