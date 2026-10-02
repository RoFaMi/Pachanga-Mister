import { db } from "../src/lib/db";

const DEFAULT_PLAYER_PHOTO = "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80";

async function sanitizeRealPlayerPhotos() {
  console.log("Cleaning base64 data-URIs from RealPlayer.photoUrl...");

  const count = await db.realPlayer.updateMany({
    where: {
      photoUrl: { startsWith: "data:" },
    },
    data: {
      photoUrl: DEFAULT_PLAYER_PHOTO,
    },
  });

  console.log(`✅ Sanitized ${count.count} RealPlayer records in database.`);

  // Also check User.avatarUrl just in case
  const userCount = await db.user.updateMany({
    where: {
      avatarUrl: { startsWith: "data:" },
    },
    data: {
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
  });

  console.log(`✅ Sanitized ${userCount.count} User avatar records in database.`);

  await db.$disconnect();
}

sanitizeRealPlayerPhotos().catch((e) => {
  console.error("Sanitization error:", e);
  process.exit(1);
});
