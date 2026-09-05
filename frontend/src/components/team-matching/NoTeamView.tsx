import arcade from "@/assets/team/arcade.png";
// arcade is a raster PNG — kept as .png

interface NoTeamViewProps {
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoinTeam: (code: string) => void;
  onCreateTeam: () => void;
  onFillMatchForm: () => void;
}

export default function NoTeamView({
  joinCode,
  onJoinCodeChange,
  onJoinTeam,
  onCreateTeam,
  onFillMatchForm,
}: NoTeamViewProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-center w-full">
        <h1 className="font-medium text-[28px] text-[#cb4643]">Team</h1>
      </div>

      {/* Content Card */}
      <div className="bg-[#fbebe9] flex flex-col items-center px-3 py-5 sm:px-5 sm:py-[30px] rounded-lg w-full gap-5">
        {/* Join Existing Team */}
        <div className="bg-white flex flex-col gap-5 items-center justify-center px-4 py-5 sm:px-8 sm:py-7 rounded-lg w-full">
          <p className="text-lg text-black text-center">Join Existing Team</p>
          <div className="flex flex-col gap-3 items-stretch justify-center w-full md:flex-row md:items-end md:gap-6">
            <div className="flex min-w-0 flex-col items-start">
              <label htmlFor="join-team-code" className="text-[15px] text-[#907960] mb-1">Team Code:</label>
              <input
                id="join-team-code"
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="_ _ _ _ _ _"
                value={joinCode}
                onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
                className="bg-white border border-[#c0ab95] rounded-lg min-h-11 px-3 py-2 w-full md:w-[295px] text-base text-black placeholder:text-[#d6d3cf] focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onJoinTeam((e.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>
            <button
              onClick={() => onJoinTeam(joinCode)}
              className="bg-[#e46966] text-[#faf4ed] font-medium text-base shrink-0 px-5 py-2.5 rounded-lg"
            >
              Find Team
            </button>
          </div>
        </div>

        {/* No Team Yet */}
        <div className="bg-white flex flex-col gap-5 items-start justify-center px-4 py-5 sm:px-8 sm:py-7 rounded-lg w-full">
          <p className="text-lg text-black text-center w-full">No Team Yet? No problem!</p>
          <div className="flex flex-col gap-3 items-stretch md:flex-row md:items-center md:justify-between w-full">
            <p className="text-lg text-black">Create New Team</p>
            <button
              onClick={onCreateTeam}
              className="bg-[#e46966] text-[#faf4ed] font-medium text-base shrink-0 px-5 py-2.5 rounded-lg"
            >
              Create New Team
            </button>
          </div>
          <div className="flex flex-col gap-3 items-stretch md:flex-row md:items-center md:justify-between w-full">
            <p className="text-lg text-black">Fill out Team Matching Form</p>
            <button
              onClick={onFillMatchForm}
              className="bg-[#e46966] text-[#faf4ed] font-medium text-base shrink-0 px-5 py-2.5 rounded-lg"
            >
              Team Match Form
            </button>
          </div>
        </div>
      </div>

      {/* Arcade graphic */}
      <div className="flex items-center justify-center gap-4">
        <img src={arcade} alt="" className="w-1/2 max-w-[401px] h-auto object-contain" />
        <p className="font-['Jersey_10'] text-[clamp(3rem,9vw,8rem)] text-[#3f1279] leading-[0.823]">
          Hack<br />On!
        </p>
      </div>
    </>
  );
}
