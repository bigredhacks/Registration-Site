import bearYou from "@/assets/team/bear-you.svg";
import bearTeammate from "@/assets/team/bear-teammate.svg";
import bearGrey1 from "@/assets/team/bear-grey-1.svg";
import bearGrey2 from "@/assets/team/bear-grey-2.svg";
import bearGrey3 from "@/assets/team/bear-grey-3.svg";

interface TeamMember {
  full_name: string;
  email: string;
}

interface HasTeamViewProps {
  teamNumber: number;
  teamCode: string;
  members: TeamMember[];
  onLeaveTeam: () => void;
}

const greyBears = [bearGrey1, bearGrey2, bearGrey3];

export default function HasTeamView({ teamNumber, teamCode, members, onLeaveTeam }: HasTeamViewProps) {
  // Fill remaining spots with grey bears (team of 4, minus "you")
  const maxTeammates = 3;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-center w-full">
        <h1 className="font-medium text-[28px] text-[#cb4643]">Team</h1>
      </div>

      {/* Team Card */}
      <div className="bg-[#fbebe9] flex flex-col items-center px-5 py-10 rounded-lg w-full">
        {/* Team header */}
        <div className="flex items-center justify-between w-full mb-6">
          <p className="text-xl font-normal text-black">Team {teamNumber}</p>
          <div className="flex items-center gap-3">
            <span className="text-base text-black">Team Code:</span>
            <span className="border border-[#cb4643] rounded-lg px-4 py-2 text-base font-medium text-black">
              {teamCode}
            </span>
          </div>
        </div>

        {/* Members */}
        <div className="flex gap-8 items-start justify-center w-full mb-6">
          {/* You */}
          <div className="flex flex-col items-center gap-px w-[200px]">
            <img src={bearYou} alt="You" className="w-[180px] h-[180px]" />
            <p className="text-[20px] text-[#787170] text-center font-medium">You</p>
          </div>

          {/* Teammates (filled or grey placeholders) */}
          {Array.from({ length: maxTeammates }).map((_, i) => {
            const member = members[i];
            if (member) {
              return (
                <div key={i} className="flex flex-col items-center gap-px w-[200px]">
                  <img src={bearTeammate} alt={member.full_name} className="w-[180px] h-[180px]" />
                  <div className="text-[20px] text-[#787170] text-center font-medium leading-normal">
                    <p>{member.full_name}</p>
                    <p>{member.email}</p>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="flex flex-col items-center gap-px w-[200px]">
                <img src={greyBears[i]} alt="" className="w-[180px] h-[180px]" />
              </div>
            );
          })}
        </div>

        {/* Leave Team button */}
        <div className="flex justify-end w-full">
          <button
            onClick={onLeaveTeam}
            className="bg-[#e46966] text-white font-medium text-base px-5 py-2.5 rounded-lg"
          >
            Leave Team
          </button>
        </div>
      </div>
    </>
  );
}
