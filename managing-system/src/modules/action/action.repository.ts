import { PrismaService } from "@/infrastructure/database";
import {
  persistedSafetyRuleSchema,
  type SafetyRule,
} from "@/modules/safety";

import type { Action, ActionExecutionResult } from "./action.types";

const actionSelection = {
  id: true,
  name: true,
  description: true,
  handlerKey: true,
  riskLevel: true,
  safetyRules: {
    select: {
      position: true,
      safetyRule: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { position: "asc" as const },
  },
  expectedOutcome: {
    select: {
      description: true,
      criteria: {
        select: {
          id: true,
          description: true,
          checkType: true,
          parameters: true,
          position: true,
        },
        orderBy: { position: "asc" as const },
      },
    },
  },
} as const;

export class ActionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActions(): Promise<Action[]> {
    const rows = await this.prisma.action.findMany({
      where: { active: true },
      select: actionSelection,
      orderBy: { id: "asc" },
    });

    return rows.map(mapAction);
  }

  async listSafetyRules(): Promise<SafetyRule[]> {
    const rows = await this.prisma.safetyRule.findMany({
      where: { active: true },
      select: {
        id: true,
        description: true,
        checkType: true,
        parameters: true,
        onFail: true,
      },
      orderBy: { id: "asc" },
    });

    return rows.map(mapSafetyRule);
  }

  async findActionById(actionId: string): Promise<Action | null> {
    const row = await this.prisma.action.findFirst({
      where: { id: actionId, active: true },
      select: actionSelection,
    });

    return row ? mapAction(row) : null;
  }

  async findSafetyRuleById(ruleId: string): Promise<SafetyRule | null> {
    const row = await this.prisma.safetyRule.findFirst({
      where: { id: ruleId, active: true },
      select: {
        id: true,
        description: true,
        checkType: true,
        parameters: true,
        onFail: true,
      },
    });

    return row ? mapSafetyRule(row) : null;
  }

  async saveActionExecutionResult(
    result: ActionExecutionResult,
  ): Promise<ActionExecutionResult> {
    await this.prisma.actionExecutionResult.upsert({
      where: { id: result.id },
      create: {
        id: result.id,
        ...toActionExecutionData(result),
        legacyPayload: null,
      },
      update: toActionExecutionData(result),
    });

    return result;
  }
}

function mapAction(row: {
  id: string;
  name: string;
  description: string;
  handlerKey: string;
  riskLevel: "low" | "medium" | "high";
  safetyRules: Array<{
    position: number;
    safetyRule: { id: string };
  }>;
  expectedOutcome: {
    description: string;
    criteria: Array<{
      id: string;
      description: string;
      checkType: Action["expectedOutcome"]["successCriteria"][number]["checkType"];
      parameters: unknown;
      position: number;
    }>;
  } | null;
}): Action {
  if (!row.expectedOutcome) {
    throw new Error(`Action ${row.id} does not have an expected outcome.`);
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    handlerKey: row.handlerKey,
    riskLevel: row.riskLevel,
    safetyRuleIds: row.safetyRules.map((link) => link.safetyRule.id),
    expectedOutcome: {
      description: row.expectedOutcome.description,
      successCriteria: row.expectedOutcome.criteria.map((criterion) => ({
        id: criterion.id,
        description: criterion.description,
        checkType: criterion.checkType,
        params: readRecord(
          criterion.parameters,
          `outcome criterion ${criterion.id} parameters`,
        ),
      })),
    },
  };
}

function toActionExecutionData(result: ActionExecutionResult) {
  return {
    trialRecordId: result.trialRecordId,
    actionId: result.actionId,
    beforeEvidenceSnapshotId: result.beforeEvidenceSnapshotId ?? null,
    afterEvidenceSnapshotId: result.afterEvidenceSnapshotId ?? null,
    status: result.status,
    continuation: result.continuation,
    startedAt: new Date(result.startedAt),
    completedAt: result.completedAt ? new Date(result.completedAt) : null,
    safetyCheckStatus: result.safetyCheckStatus,
    failedSafetyRuleIds: result.failedSafetyRuleIds,
    output: result.output ?? null,
    error: result.error ?? null,
    expectedOutcomeMet: result.expectedOutcomeMet ?? null,
    outcomeSummary: result.outcomeSummary ?? null,
  };
}

function readRecord(value: unknown, description: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Persisted ${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function mapSafetyRule(row: {
  id: string;
  description: string;
  checkType: "evidence_state_matches" | "max_attempts_not_exceeded";
  parameters: unknown;
  onFail: "block" | "escalate";
}): SafetyRule {
  return persistedSafetyRuleSchema.parse({
    id: row.id,
    description: row.description,
    checkType: row.checkType,
    params: row.parameters,
    onFail: row.onFail,
  });
}
