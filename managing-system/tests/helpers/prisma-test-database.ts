import { PrismaService } from "@/infrastructure/database";
import { seedCatalogue } from "../../prisma/catalogue";

export async function createPrismaTestDatabase(options?: {
  seed?: boolean;
}): Promise<{
  prisma: PrismaService;
  close(): Promise<void>;
}> {
  const prisma = new PrismaService();
  await prisma.open();
  await clearDatabase(prisma);

  if (options?.seed) {
    await seedCatalogue(prisma);
  }

  return {
    prisma,
    async close() {
      try {
        await clearDatabase(prisma);
      } finally {
        await prisma.close();
      }
    },
  };
}

async function clearDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "action_execution_results",
      "evaluation_summaries",
      "recovery_decisions",
      "recovery_plan_actions",
      "recovery_plans",
      "diagnosis_results",
      "trial_evidence_snapshots",
      "trial_records",
      "raw_evidence",
      "evidence_signals",
      "evidence_incidents",
      "evidence_snapshots",
      "baseline_rule_actions",
      "baseline_rule_conditions",
      "baseline_rule_condition_groups",
      "baseline_rules",
      "action_safety_rules",
      "outcome_criteria",
      "expected_outcomes",
      "safety_rules",
      "actions"
    RESTART IDENTITY CASCADE
  `);
}
