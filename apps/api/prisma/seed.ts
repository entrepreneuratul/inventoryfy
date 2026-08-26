import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Business } from '../generated/prisma/client';
import { MembershipRole, MembershipStatus, TeamRole } from '../generated/prisma/enums';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Demo credentials — printed at the end and documented in README.md.
// Password is the same for every seeded account, for convenience in dev.
const DEMO_PASSWORD = 'password123';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const businessSeeds = [
    { name: 'Northside Hardware', type: 'Retail' },
    { name: 'Coastal Wholesale Co.', type: 'Wholesale' },
    // Ritkalp (ritkalp.com) — a real, separately-deployed Next.js storefront
    // that plugs into this business via the Phase 10 Integrations API.
    // Same owner account as the demo businesses above, just another
    // business it owns (Inventoryfy's multi-business-owner model already
    // supports this — no new signup flow needed).
    { name: 'Ritkalp', type: 'Ecommerce — Puja Kits' },
  ];

  const businesses: Business[] = [];
  for (const seed of businessSeeds) {
    const business = await prisma.business.upsert({
      where: { id: `seed-${slug(seed.name)}` },
      update: {},
      create: { id: `seed-${slug(seed.name)}`, name: seed.name, type: seed.type },
    });
    businesses.push(business);
  }

  // Ritkalp needs at least one warehouse to hold real stock — the other
  // two seeded businesses get theirs created through the app's own UI
  // during manual testing, but Ritkalp's is created here so its own
  // one-time catalog-sync script (Ritkalp repo: scripts/sync-inventoryfy.ts)
  // has something to point at without a manual setup step first.
  const ritkalp = businesses.find((b) => b.name === 'Ritkalp')!;
  await prisma.warehouse.upsert({
    where: { id: 'seed-ritkalp-main' },
    update: {},
    create: { id: 'seed-ritkalp-main', businessId: ritkalp.id, name: 'Main Warehouse' },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@inventoryfy.dev' },
    update: {},
    create: { email: 'owner@inventoryfy.dev', name: 'Olivia Owner', passwordHash },
  });

  for (const business of businesses) {
    await prisma.membership.upsert({
      where: { userId_businessId: { userId: owner.id, businessId: business.id } },
      update: {},
      create: {
        userId: owner.id,
        businessId: business.id,
        role: MembershipRole.OWNER,
        teamRole: TeamRole.OWNER,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });
  }

  const staff = await prisma.user.upsert({
    where: { email: 'staff@inventoryfy.dev' },
    update: {},
    create: { email: 'staff@inventoryfy.dev', name: 'Sam Staff', passwordHash },
  });

  await prisma.membership.upsert({
    where: { userId_businessId: { userId: staff.id, businessId: businesses[0].id } },
    update: {},
    create: {
      userId: staff.id,
      businessId: businesses[0].id,
      role: MembershipRole.STAFF,
      teamRole: TeamRole.SALES_STAFF,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    },
  });

  console.log('\nSeed complete. Demo accounts (all use password: %s):\n', DEMO_PASSWORD);
  console.log('  Owner  — owner@inventoryfy.dev  (owns every seeded business)');
  console.log(`  Staff  — staff@inventoryfy.dev  (business: ${businesses[0].name})`);
  console.log('\nBusinesses:');
  for (const b of businesses) console.log(`  - ${b.name} (${b.id})`);
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
