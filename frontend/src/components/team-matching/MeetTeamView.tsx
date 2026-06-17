import bearYou from "@/assets/team/bear-you.svg";
import bearTeammate from "@/assets/team/bear-teammate.svg";

interface TeamMember {
  full_name: string;
  email: string;
}

interface MeetTeamViewProps {
  members: TeamMember[];
  onViewTeam: () => void;
  onBack: () => void;
}

export default function MeetTeamView({ members, onViewTeam, onBack }: MeetTeamViewProps) {
  return (
    <>
      {/* Header with back arrow */}
      <div className="flex gap-10 items-center w-full">
        <button onClick={onBack} className="text-[#cb4643] text-xl">&lsaquo;</button>
        <h1 className="font-medium text-[28px] text-[#cb4643]">Meet Your Team!</h1>
      </div>

      {/* Content */}
      <div className="bg-[#fbebe9] flex flex-col gap-5 items-center px-5 py-10 rounded-lg w-full">
        {/* Message */}
        <div className="bg-white flex flex-col items-start px-6 py-6 rounded-lg w-full">
          <div className="text-[20px] text-[#322625] text-center w-full py-3 leading-normal">
            <p className="mb-6">Meet your dream team...</p>
            <p>Don't forget to reach out and introduce yourself!</p>
          </div>
        </div>

        {/* You avatar */}
        <div className="flex flex-col items-center gap-px">
          <img src={bearYou} alt="You" className="w-[180px] h-[180px]" />
          <p className="text-[20px] text-[#787170] text-center font-medium">You</p>
        </div>

        {/* Teammate avatars */}
        <div className="flex gap-[18px] items-center">
          {members.map((member, i) => (
            <div key={i} className="flex flex-col items-center gap-px w-[244px]">
              <img src={bearTeammate} alt={member.full_name} className="w-[180px] h-[180px]" />
              <div className="text-[20px] text-[#787170] text-center font-medium leading-normal">
                <p>{member.full_name}</p>
                <p>{member.email}</p>
              </div>
            </div>
          ))}
        </div>

        {/* View Team button */}
        <button
          onClick={onViewTeam}
          className="bg-[#e46966] text-[#faf4ed] font-medium text-base px-5 py-2.5 rounded-lg w-full"
        >
          View Team
        </button>
      </div>
    </>
  );
}
