import { db } from "../src/lib/db";

async function checkRealPlayerPhotos() {
  const players = await db.realPlayer.findMany({
    where: {
      photoUrl: { startsWith: "data:" },
    },
    select: {
      id: true,
      name: true,
      photoUrl: true,
    },
  });

  console.log(`Found ${players.length} RealPlayer records with base64 data-URIs.`);
  let totalBytes = 0;
  players.forEach((p) => {
    const len = p.photoUrl?.length || 0;
    totalBytes += len;
    console.log(`  • Player: ${p.name} (${p.id}) | photoUrl size: ${(len / 1024).toFixed(1)} KB`);
  });

  console.log(`\nTotal base64 photo bloat in RealPlayer table: ${(totalBytes / 1024).toFixed(1)} KB (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);

  await db.$disconnect();
}

checkRealPlayerPhotos();
