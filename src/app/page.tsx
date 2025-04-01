import PlayerStatsTable from "@/components/PlayerStatsTable"; // Using alias defined during setup

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      {/* Wrap the table in a container if needed, or let it control its own padding */}
      <div className="w-full">
         {/* Pass the current season year (adjust as needed for the actual current NBA season) */}
         {/* The API uses the *start* year of the season, e.g., 2024 for the 2024-25 season */}
        <PlayerStatsTable initialSeason={2024} />
      </div>
    </main>
  );
}