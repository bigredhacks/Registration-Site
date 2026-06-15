import arcade from "@/assets/team/arcade.png";
// arcade is a raster PNG — kept as .png

interface NoTeamViewProps {
  onJoinTeam: (code: string) => void;
  onCreateTeam: () => void;
  onFillMatchForm: () => void;
}

export default function NoTeamView({ onJoinTeam, onCreateTeam, onFillMatchForm }: NoTeamViewProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-center w-full">
        <h1 className="font-medium text-[28px] text-[#cb4643]">Team</h1>
      </div>

      {/* Content Card */}
      <div className="bg-[#fbebe9] flex flex-col items-center px-5 py-[30px] rounded-lg w-full gap-5">
        {/* Join Existing Team */}
        <div className="bg-white flex flex-col gap-5 items-center justify-center px-8 py-7 rounded-lg w-full">
          <p className="text-lg text-black text-center">Join Existing Team</p>
          <div className="flex gap-10 items-end justify-center w-full">
            <div className="flex flex-col items-start">
              <label className="text-[15px] text-[#907960] mb-1">Team Code:</label>
              <input
                type="text"
                placeholder="_ _ _ _ _ _"
                className="bg-white border border-[#c0ab95] rounded-lg h-[42px] px-3 py-2 w-[295px] text-sm text-black placeholder:text-[#d6d3cf] focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onJoinTeam((e.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>
            <button
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('input[placeholder="_ _ _ _ _ _"]');
                if (input) onJoinTeam(input.value);
              }}
              className="bg-[#e46966] text-[#faf4ed] font-medium text-base px-5 py-2.5 rounded-lg"
            >
              Find Team
            </button>
          </div>
        </div>

        {/* No Team Yet */}
        <div className="bg-white flex flex-col gap-5 items-start justify-center px-8 py-7 rounded-lg w-full">
          <p className="text-lg text-black text-center w-full">No Team Yet? No problem!</p>
          <div className="flex items-center justify-between w-full">
            <p className="text-lg text-black">Create New Team</p>
            <button
              onClick={onCreateTeam}
              className="bg-[#e46966] text-[#faf4ed] font-medium text-base px-5 py-2.5 rounded-lg"
            >
              Create New Team
            </button>
          </div>
          <div className="flex items-center justify-between w-full">
            <p className="text-lg text-black">Fill out Team Matching Form</p>
            <button
              onClick={onFillMatchForm}
              className="bg-[#e46966] text-[#faf4ed] font-medium text-base px-5 py-2.5 rounded-lg"
            >
              Team Match Form
            </button>
          </div>
        </div>
      </div>

      {/* Arcade graphic */}
      <div className="flex items-center justify-center gap-4">
        <img src={arcade} alt="" className="w-[401px] h-[401px] object-contain" />
        <p className="font-['Jersey_10'] text-[128px] text-[#3f1279] leading-[0.823]">
          Hack<br />On!
        </p>
      </div>
    </>
  );
}
