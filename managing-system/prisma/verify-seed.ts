import { PrismaService } from "../src/infrastructure/database/prisma.service";
import { expectedCatalogueCounts } from "./catalogue";

const prisma = new PrismaService();

try {
  await prisma.open();

  const actualCounts = {
    actions: await prisma.action.count(),
    safetyRules: await prisma.safetyRule.count(),
    expectedOutcomes: await prisma.expectedOutcome.count(),
    outcomeCriteria: await prisma.outcomeCriterion.count(),
    actionSafetyRules: await prisma.actionSafetyRule.count(),
    baselineRules: await prisma.baselineRule.count(),
    baselineConditionGroups: await prisma.baselineRuleConditionGroup.count(),
    baselineConditions: await prisma.baselineRuleCondition.count(),
    baselineActions: await prisma.baselineRuleAction.count(),
  };

  if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCatalogueCounts)) {
    throw new Error(
      `Seed catalogue counts do not match. Expected ${JSON.stringify(expectedCatalogueCounts)}, received ${JSON.stringify(actualCounts)}.`,
    );
  }

  console.log({ event: "catalogue_seed_verified", counts: actualCounts });
} finally {
  await prisma.close();
}
