import { PrismaService } from "../src/infrastructure/database/prisma.service";
import { seedCatalogue } from "./catalogue";

const prisma = new PrismaService();

try {
  await prisma.open();
  await seedCatalogue(prisma);
} finally {
  await prisma.close();
}
