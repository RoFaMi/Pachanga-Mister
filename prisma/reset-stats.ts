import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up all matchday and real statistics...");

  const fs = await prisma.fantasyScore.deleteMany({});
  console.log(`Deleted ${fs.count} fantasy scores.`);

  const mr = await prisma.matchRating.deleteMany({});
  console.log(`Deleted ${mr.count} match ratings.`);

  const me = await prisma.matchEvent.deleteMany({});
  console.log(`Deleted ${me.count} match events.`);

  const ml = await prisma.matchLineup.deleteMany({});
  console.log(`Deleted ${ml.count} match lineups.`);

  const m = await prisma.match.deleteMany({});
  console.log(`Deleted ${m.count} matches.`);

  const mt = await prisma.matchTeam.deleteMany({});
  console.log(`Deleted ${mt.count} match teams.`);

  const fc = await prisma.fantasyCaptain.deleteMany({});
  console.log(`Deleted ${fc.count} fantasy captains.`);

  const md = await prisma.matchday.deleteMany({});
  console.log(`Deleted ${md.count} matchdays.`);

  const ft = await prisma.fantasyTeam.updateMany({
    data: {
      totalPoints: 0.0,
      lastMatchdayPoints: 0.0,
      accumulatedEarnings: 0.0,
    },
  });
  console.log(`Reset statistics for ${ft.count} fantasy teams.`);

  const rp = await prisma.realPlayer.updateMany({
    data: {
      clauseIncrements: 0,
      shieldedAtMatchdayNumber: null,
    },
  });
  console.log(`Reset clause/shield statistics for ${rp.count} real players.`);

  console.log("Stats reset successfully!");
}

main()
  .catch((e) => {
    console.error("Error resetting stats:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
