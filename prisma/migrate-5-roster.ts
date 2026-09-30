import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Migrating FantasyRosters to 5 futsal starter slots (POR, CIERRE, ALA_1, ALA_2, PIVOT)...");

  const rosters = await prisma.fantasyRoster.findMany({
    include: { fantasyTeam: true },
  });

  const slotsOrder = ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT"];

  const teamRostersMap = new Map<string, typeof rosters>();
  for (const r of rosters) {
    const list = teamRostersMap.get(r.fantasyTeamId) || [];
    list.push(r);
    teamRostersMap.set(r.fantasyTeamId, list);
  }

  for (const [teamId, teamRoster] of teamRostersMap.entries()) {
    const occupiedSlots = new Set<string>();
    for (const entry of teamRoster) {
      if (slotsOrder.includes(entry.positionSlot)) {
        occupiedSlots.add(entry.positionSlot);
      }
    }

    for (const entry of teamRoster) {
      if (entry.positionSlot === "SUPLENTE_1" || !slotsOrder.includes(entry.positionSlot)) {
        const freeSlot = slotsOrder.find((s) => !occupiedSlots.has(s));
        if (freeSlot) {
          await prisma.fantasyRoster.update({
            where: { id: entry.id },
            data: { positionSlot: freeSlot },
          });
          occupiedSlots.add(freeSlot);
          console.log(`Reassigned player ${entry.realPlayerId} in team ${teamId} to free slot ${freeSlot}.`);
        } else {
          await prisma.fantasyRoster.update({
            where: { id: entry.id },
            data: { positionSlot: "EXCESO_6" },
          });
          console.log(`Team ${teamId} has excess 6th player ${entry.realPlayerId} marked as EXCESO_6.`);
        }
      }
    }
  }

  console.log("Roster 5-player migration finished successfully.");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
