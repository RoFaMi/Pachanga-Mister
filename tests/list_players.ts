import { db } from "../src/lib/db";

async function listPlayersAndUsers() {
  const users = await db.user.findMany({ select: { id: true, nickname: true, avatarUrl: true } });
  console.log("=== USERS ===");
  users.forEach((u) => console.log(`User: ${u.nickname} | avatarUrl: ${u.avatarUrl}`));

  const players = await db.realPlayer.findMany({ select: { id: true, name: true, nickname: true, photoUrl: true } });
  console.log("\n=== REAL PLAYERS ===");
  players.forEach((p) => console.log(`Player: ${p.name} (${p.nickname}) | photoUrl: ${p.photoUrl}`));

  await db.$disconnect();
}

listPlayersAndUsers();
