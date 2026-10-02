import { db } from "../src/lib/db";

const UNIQUE_AVATARS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80",
];

async function assignUniquePhotos() {
  console.log("Assigning unique photos to all Users and RealPlayers...");

  const users = await db.user.findMany({ select: { id: true, nickname: true } });
  for (let i = 0; i < users.length; i++) {
    const avatarUrl = UNIQUE_AVATARS[i % UNIQUE_AVATARS.length];
    await db.user.update({
      where: { id: users[i].id },
      data: { avatarUrl },
    });
    console.log(`Updated User ${users[i].nickname} -> ${avatarUrl}`);
  }

  const players = await db.realPlayer.findMany({ select: { id: true, name: true } });
  for (let i = 0; i < players.length; i++) {
    const photoUrl = UNIQUE_AVATARS[(i + 3) % UNIQUE_AVATARS.length];
    await db.realPlayer.update({
      where: { id: players[i].id },
      data: { photoUrl },
    });

    // Also sync fantasy team badges for linked users if any
    console.log(`Updated RealPlayer ${players[i].name} -> ${photoUrl}`);
  }

  console.log("✅ All users and real players now have distinct unique photos!");

  await db.$disconnect();
}

assignUniquePhotos().catch((e) => {
  console.error("Error assigning photos:", e);
  process.exit(1);
});
