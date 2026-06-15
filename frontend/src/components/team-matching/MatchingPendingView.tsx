import bearYou from "@/assets/team/bear-you.svg";
import bearGrey1 from "@/assets/team/bear-grey-1.svg";
import bearGrey2 from "@/assets/team/bear-grey-2.svg";
import bearGrey3 from "@/assets/team/bear-grey-3.svg";

interface MatchingPendingViewProps {
  onEditPreferences: () => void;
  onBack: () => void;
}

export default function MatchingPendingView({ onEditPreferences, onBack }: MatchingPendingViewProps) {
  return (
    <>
      {/* Header with back arrow */}
      <div className="flex gap-10 items-center w-full">
        <button onClick={onBack} className="text-[#cb4643] text-xl">&lsaquo;</button>
        <h1 className="font-medium text-[28px] text-[#cb4643]">
          Matching you with Teammates...
        </h1>
      </div>

      {/* Content */}
      <div className="bg-[#fbebe9] flex flex-col gap-5 items-center px-5 py-10 rounded-lg w-full">
        {/* Message */}
        <div className="bg-white flex flex-col items-start px-6 py-6 rounded-lg w-full">
          <div className="text-[20px] text-[#322625] text-center w-full py-3 leading-normal">
            <p className="mb-6">Team matches will be released 1 week before the hackathon.</p>
            <p>Come back soon to see your team!</p>
          </div>
        </div>

        {/* You avatar */}
        <div className="flex flex-col items-center gap-px">
          <img src={bearYou} alt="You" className="w-[180px] h-[180px]" />
          <p className="text-[20px] text-[#787170] text-center font-medium">You</p>
        </div>

        {/* Grey teammate placeholders */}
        <div className="flex gap-16 items-center">
          <img src={bearGrey1} alt="" className="w-[180px] h-[180px]" />
          <img src={bearGrey2} alt="" className="w-[180px] h-[180px]" />
          <img src={bearGrey3} alt="" className="w-[180px] h-[180px]" />
        </div>

        {/* Edit Team Preferences button */}
        <button
          onClick={onEditPreferences}
          className="bg-[#e46966] text-[#faf4ed] font-medium text-base px-5 py-2.5 rounded-lg w-full"
        >
          Edit Team Preferences
        </button>
      </div>
    </>
  );
}
