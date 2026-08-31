import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("SEED_ADMIN_EMAIL is not set. Add it to .env before seeding.");
  }

  const admin = await prisma.staff.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "管理者",
      email: adminEmail,
      role: "ADMIN",
    },
  });

  console.log(`Seeded admin staff: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
