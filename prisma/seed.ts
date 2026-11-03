import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = [
    { email: 'user1@example.com', name: 'Test User One', balance: '500.00' },
    { email: 'user2@example.com', name: 'Test User Two', balance: '100.00' },
    { email: 'user3@example.com', name: 'Test User Three', balance: '0.00' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        balance: user.balance,
      },
      create: user,
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
