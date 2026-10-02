import { db } from "../src/lib/db";

async function inspectData() {
  const transfers = await db.transfer.findMany({ take: 10 });
  for (const t of transfers) {
    if (t.bidsSummary) {
      console.log(`Transfer ID: ${t.id}, bidsSummary length: ${t.bidsSummary.length} chars`);
    }
  }

  const realPlayers = await db.realPlayer.findMany({ take: 10 });
  for (const p of realPlayers) {
    if (p.photoUrl && p.photoUrl.length > 500) {
      console.log(`RealPlayer ID: ${p.id}, name: ${p.name}, photoUrl length: ${p.photoUrl.length} chars`);
    }
  }

  const users = await db.user.findMany({ take: 10 });
  for (const u of users) {
    if (u.avatarUrl && u.avatarUrl.length > 500) {
      console.log(`User ID: ${u.id}, nickname: ${u.nickname}, avatarUrl length: ${u.avatarUrl.length} chars`);
    }
  }

  await db.$disconnect();
}

inspectData();
