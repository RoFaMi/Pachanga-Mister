import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Cleaning database...");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.playerMarketValue.deleteMany();
  await prisma.fantasyScore.deleteMany();
  await prisma.matchRating.deleteMany();
  await prisma.matchEvent.deleteMany();
  await prisma.matchLineup.deleteMany();
  await prisma.match.deleteMany();
  await prisma.matchTeam.deleteMany();
  await prisma.fantasyCaptain.deleteMany();
  await prisma.fantasyRoster.deleteMany();
  await prisma.fantasyTeam.deleteMany();
  await prisma.matchday.deleteMany();
  await prisma.realPlayer.deleteMany();
  await prisma.leagueMember.deleteMany();
  await prisma.league.deleteMany();
  await prisma.user.deleteMany();

  console.log("👤 Creating demo users...");
  const hashedPassword = await bcrypt.hash("pachanga123", 10);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@pachanga.com",
      passwordHash: hashedPassword,
      fullName: "Carlos 'Míster' Rodríguez",
      nickname: "El Míster",
      role: "ADMIN",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
  });

  const user1 = await prisma.user.create({
    data: {
      email: "pablo@pachanga.com",
      passwordHash: hashedPassword,
      fullName: "Pablo DT",
      nickname: "Pablito",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "pedri@pachanga.com",
      passwordHash: hashedPassword,
      fullName: "Pedri González",
      nickname: "Don Pedri",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: "nico@pachanga.com",
      passwordHash: hashedPassword,
      fullName: "Nico Williams",
      nickname: "El Rayo",
      avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
    },
  });

  const user4 = await prisma.user.create({
    data: {
      email: "borja@pachanga.com",
      passwordHash: hashedPassword,
      fullName: "Borja Iglesias",
      nickname: "El Panda",
      avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    },
  });

  console.log("🏆 Creating Demo League...");
  const league = await prisma.league.create({
    data: {
      name: "Liga Pachanga de los Sabadetes 5v5",
      code: "PACHANGA5V5",
      description: "Nuestra liga privada oficial de fútbol sala. Pachangas todos los sábados a las 11:00h.",
      logoUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200&auto=format&fit=crop&q=80",
      maxMembers: 18,
      initialBudget: 30.0,
      maxOwnersPerPlayer: 18, // Unlimited sharing allowed for 5-man rosters
      ownerId: adminUser.id,
      scoringConfig: JSON.stringify({
        goal: 5,
        assist: 3,
        win: 3,
        loss: -2,
        decisivePenalty: 3,
        goalkeeperConceded: -1,
      }),
    },
  });

  // Create League Memberships
  await prisma.leagueMember.createMany({
    data: [
      { leagueId: league.id, userId: adminUser.id, role: "ADMIN" },
      { leagueId: league.id, userId: user1.id, role: "PARTICIPANT" },
      { leagueId: league.id, userId: user2.id, role: "PARTICIPANT" },
      { leagueId: league.id, userId: user3.id, role: "PARTICIPANT" },
      { leagueId: league.id, userId: user4.id, role: "PARTICIPANT" },
    ],
  });

  console.log("⚽ Creating 18 Real Players...");
  const playersData = [
    // PORTEROS (3)
    { name: "Carlos Martínez", nickname: "El Muro", position: "POR", marketValue: 12.5, photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", userId: adminUser.id },
    { name: "David Soria", nickname: "Guantes de Oro", position: "POR", marketValue: 11.0, photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80", userId: user1.id },
    { name: "Marc Ter Stegen", nickname: "El Pulpo", position: "POR", marketValue: 10.5, photoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80" },

    // CIERRES (4)
    { name: "Sergio Ramos", nickname: "El Kaiser", position: "CIERRE", marketValue: 14.0, photoUrl: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80", userId: user2.id },
    { name: "Javi Ruiz", nickname: "Cerrojo", position: "CIERRE", marketValue: 9.5, photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80", userId: user3.id },
    { name: "Álex Fernández", nickname: "Escudo", position: "CIERRE", marketValue: 8.5, photoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80", userId: user4.id },
    { name: "Lucas Vázquez", nickname: "Titán", position: "CIERRE", marketValue: 8.0, photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },

    // ALAS (6)
    { name: "Pablo Martín", nickname: "Gavi", position: "ALA", marketValue: 15.0, photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
    { name: "Pedri González", nickname: "Magia", position: "ALA", marketValue: 16.5, photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
    { name: "Nico Williams", nickname: "Rayo", position: "ALA", marketValue: 15.5, photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
    { name: "Dani Olmo", nickname: "Chispa", position: "ALA", marketValue: 13.0, photoUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80" },
    { name: "Isco Alarcón", nickname: "Alquimia", position: "ALA", marketValue: 12.0, photoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80" },
    { name: "Brahim Díaz", nickname: "Diablo", position: "ALA", marketValue: 11.5, photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80" },

    // PÍVOTS (5)
    { name: "Raúl García", nickname: "Goleador", position: "PIVOT", marketValue: 15.0, photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80" },
    { name: "Borja Iglesias", nickname: "Tanque", position: "PIVOT", marketValue: 13.5, photoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80" },
    { name: "Ferran Torres", nickname: "Tiburón", position: "PIVOT", marketValue: 12.5, photoUrl: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80" },
    { name: "Joselu Mato", nickname: "Aéreo", position: "PIVOT", marketValue: 11.0, photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80" },
    { name: "Gerard Moreno", nickname: "Matador", position: "PIVOT", marketValue: 14.5, photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
  ];

  const createdPlayers: any[] = [];
  for (const p of playersData) {
    const created = await prisma.realPlayer.create({
      data: {
        leagueId: league.id,
        name: p.name,
        nickname: p.nickname,
        position: p.position,
        marketValue: p.marketValue,
        photoUrl: p.photoUrl,
        isDemo: true,
        userId: p.userId || null,
      },
    });
    createdPlayers.push(created);
  }

  // Map helper
  const playerByNick = (nick: string) => createdPlayers.find((p) => p.nickname === nick)!;

  console.log("🎮 Creating Fantasy Teams & Rosters...");
  // 1. Admin Fantasy Team: "Míster Pachanga FC"
  const ftAdmin = await prisma.fantasyTeam.create({
    data: {
      leagueId: league.id,
      userId: adminUser.id,
      name: "Míster Pachanga FC",
      badgeUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80",
      budget: 8.5, // 50 - sum(values)
      totalPoints: 48.5,
      lastMatchdayPoints: 24.5,
    },
  });

  const adminRoster = [
    { realPlayerId: playerByNick("El Muro").id, positionSlot: "POR", price: 12.5 },
    { realPlayerId: playerByNick("El Kaiser").id, positionSlot: "CIERRE", price: 14.0 },
    { realPlayerId: playerByNick("Magia").id, positionSlot: "ALA_1", price: 16.5 },
    { realPlayerId: playerByNick("Rayo").id, positionSlot: "ALA_2", price: 15.5 },
    { realPlayerId: playerByNick("Goleador").id, positionSlot: "PIVOT", price: 15.0 },
  ];
  for (const r of adminRoster) {
    await prisma.fantasyRoster.create({
      data: { fantasyTeamId: ftAdmin.id, realPlayerId: r.realPlayerId, positionSlot: r.positionSlot, purchasePrice: r.price },
    });
  }

  // 2. User 1 Fantasy Team: "Pablito Team"
  const ftUser1 = await prisma.fantasyTeam.create({
    data: {
      leagueId: league.id,
      userId: user1.id,
      name: "Pablito Team",
      badgeUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80",
      budget: 10.0,
      totalPoints: 42.0,
      lastMatchdayPoints: 21.0,
    },
  });
  const user1Roster = [
    { realPlayerId: playerByNick("Guantes de Oro").id, positionSlot: "POR", price: 11.0 },
    { realPlayerId: playerByNick("Cerrojo").id, positionSlot: "CIERRE", price: 9.5 },
    { realPlayerId: playerByNick("Gavi").id, positionSlot: "ALA_1", price: 15.0 },
    { realPlayerId: playerByNick("Chispa").id, positionSlot: "ALA_2", price: 13.0 },
    { realPlayerId: playerByNick("Tanque").id, positionSlot: "PIVOT", price: 13.5 },
  ];
  for (const r of user1Roster) {
    await prisma.fantasyRoster.create({
      data: { fantasyTeamId: ftUser1.id, realPlayerId: r.realPlayerId, positionSlot: r.positionSlot, purchasePrice: r.price },
    });
  }

  // 3. User 2 Fantasy Team: "Don Pedri Magic"
  const ftUser2 = await prisma.fantasyTeam.create({
    data: {
      leagueId: league.id,
      userId: user2.id,
      name: "Don Pedri Magic",
      badgeUrl: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=150&auto=format&fit=crop&q=80",
      budget: 12.0,
      totalPoints: 39.5,
      lastMatchdayPoints: 19.5,
    },
  });
  const user2Roster = [
    { realPlayerId: playerByNick("El Pulpo").id, positionSlot: "POR", price: 10.5 },
    { realPlayerId: playerByNick("Escudo").id, positionSlot: "CIERRE", price: 8.5 },
    { realPlayerId: playerByNick("Magia").id, positionSlot: "ALA_1", price: 16.5 },
    { realPlayerId: playerByNick("Alquimia").id, positionSlot: "ALA_2", price: 12.0 },
    { realPlayerId: playerByNick("Matador").id, positionSlot: "PIVOT", price: 14.5 },
  ];
  for (const r of user2Roster) {
    await prisma.fantasyRoster.create({
      data: { fantasyTeamId: ftUser2.id, realPlayerId: r.realPlayerId, positionSlot: r.positionSlot, purchasePrice: r.price },
    });
  }

  console.log("📅 Creating Matchdays & Matches...");
  // Matchday 1
  const md1 = await prisma.matchday.create({
    data: {
      leagueId: league.id,
      number: 1,
      name: "Jornada 1 - Apertura de Temporada",
      status: "COMPLETED",
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Captains for Matchday 1
  await prisma.fantasyCaptain.create({
    data: { fantasyTeamId: ftAdmin.id, matchdayId: md1.id, realPlayerId: playerByNick("Magia").id },
  });
  await prisma.fantasyCaptain.create({
    data: { fantasyTeamId: ftUser1.id, matchdayId: md1.id, realPlayerId: playerByNick("Tanque").id },
  });

  // Create 3 Real Teams for Matchday 1
  const teamA = await prisma.matchTeam.create({
    data: { matchdayId: md1.id, name: "Equipo A (Verdes)", color: "#10B981" },
  });
  const teamB = await prisma.matchTeam.create({
    data: { matchdayId: md1.id, name: "Equipo B (Azules)", color: "#3B82F6" },
  });
  const teamC = await prisma.matchTeam.create({
    data: { matchdayId: md1.id, name: "Equipo C (Naranjas)", color: "#F97316" },
  });

  // Match 1: Equipo A vs Equipo B (2 - 1)
  const match1 = await prisma.match.create({
    data: {
      matchdayId: md1.id,
      matchNumber: 1,
      teamAId: teamA.id,
      teamBId: teamB.id,
      scoreA: 2,
      scoreB: 1,
      status: "FINISHED",
      durationSeconds: 480,
      endedCondition: "TWO_GOALS",
    },
  });

  // Lineup Match 1 (Team A)
  const teamAPlayers = [
    { p: playerByNick("El Muro"), isGk: true },
    { p: playerByNick("El Kaiser"), isGk: false },
    { p: playerByNick("Magia"), isGk: false },
    { p: playerByNick("Rayo"), isGk: false },
    { p: playerByNick("Goleador"), isGk: false },
  ];
  for (const item of teamAPlayers) {
    await prisma.matchLineup.create({
      data: { matchId: match1.id, matchTeamId: teamA.id, realPlayerId: item.p.id, isGoalkeeper: item.isGk },
    });
  }

  // Lineup Match 1 (Team B)
  const teamBPlayers = [
    { p: playerByNick("Guantes de Oro"), isGk: true },
    { p: playerByNick("Cerrojo"), isGk: false },
    { p: playerByNick("Gavi"), isGk: false },
    { p: playerByNick("Chispa"), isGk: false },
    { p: playerByNick("Tanque"), isGk: false },
  ];
  for (const item of teamBPlayers) {
    await prisma.matchLineup.create({
      data: { matchId: match1.id, matchTeamId: teamB.id, realPlayerId: item.p.id, isGoalkeeper: item.isGk },
    });
  }

  // Match 1 Events
  await prisma.matchEvent.create({
    data: {
      matchId: match1.id,
      type: "GOAL",
      realPlayerId: playerByNick("Magia").id,
      assisterPlayerId: playerByNick("El Kaiser").id,
      minute: 3,
    },
  });
  await prisma.matchEvent.create({
    data: {
      matchId: match1.id,
      type: "GOAL",
      realPlayerId: playerByNick("Tanque").id,
      assisterPlayerId: playerByNick("Gavi").id,
      minute: 5,
    },
  });
  await prisma.matchEvent.create({
    data: {
      matchId: match1.id,
      type: "GOAL",
      realPlayerId: playerByNick("Goleador").id,
      assisterPlayerId: playerByNick("Magia").id,
      minute: 7,
    },
  });

  // Peer Ratings for Match 1
  const ratingsMatch1 = [
    { eval: adminUser.id, target: playerByNick("Magia").id, score: 9.0 },
    { eval: user1.id, target: playerByNick("Magia").id, score: 8.5 },
    { eval: adminUser.id, target: playerByNick("Goleador").id, score: 8.0 },
    { eval: user1.id, target: playerByNick("El Muro").id, score: 7.5 },
  ];
  for (const r of ratingsMatch1) {
    await prisma.matchRating.create({
      data: { matchId: match1.id, evaluatorUserId: r.eval, targetRealPlayerId: r.target, score: r.score },
    });
  }

  // Matchday 2 (Current / Scheduled)
  await prisma.matchday.create({
    data: {
      leagueId: league.id,
      number: 2,
      name: "Jornada 2 - Próximo Sábado",
      status: "SCHEDULED",
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("🔔 Creating Initial Notifications...");
  await prisma.notification.createMany({
    data: [
      { userId: adminUser.id, title: "Bienvenido a Míster Pachanga", message: "Tu liga 'Liga Pachanga de los Sabadetes' está lista. ¡Organiza los partidos y disfruta!", type: "INFO" },
      { userId: user1.id, title: "Próxima Pachanga", message: "La Jornada 2 comenzará este sábado a las 11:00h.", type: "MATCHDAY" },
      { userId: user2.id, title: "Valoración completada", message: "Tus valoraciones de la Jornada 1 se han procesado correctamente.", type: "RATING" },
    ],
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
