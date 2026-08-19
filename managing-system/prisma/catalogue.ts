import type { PrismaService } from "../src/infrastructure/database/prisma.service";

const safetyRules = [
  {
    id: "allow_only_when_system_not_healthy",
    description:
      "Only allow this recovery action when the managed system is degraded or unhealthy.",
    checkType: "evidence_state_matches" as const,
    parameters: { allowedStates: ["degraded", "unhealthy"] },
    onFail: "block" as const,
  },
  {
    id: "max_one_attempt_per_cycle",
    description:
      "Only allow one execution attempt for the same action within the current recovery cycle.",
    checkType: "max_attempts_not_exceeded" as const,
    parameters: { maxAttempts: 1 },
    onFail: "escalate" as const,
  },
];

const actions = [
  {
    id: "restart_postgres_container",
    name: "Restart PostgreSQL container",
    description: "Restart the PostgreSQL container used by the managed system testbed.",
    handlerKey: "restart_postgres_container",
    riskLevel: "medium" as const,
    expectedOutcome: {
      id: "restart_postgres_container_outcome",
      description: "Database readiness should recover after the PostgreSQL container restart.",
      criteria: [
        {
          id: "health_ready_after_postgres_restart",
          description: "Health endpoint should report a healthy state after the restart.",
          checkType: "health_status_is" as const,
          parameters: { expectedState: "healthy" },
        },
      ],
    },
  },
  {
    id: "restart_managed_system_service",
    name: "Restart managed-system service",
    description:
      "Restart the managed-system application service when the system is degraded or unhealthy.",
    handlerKey: "restart_managed_system_service",
    riskLevel: "medium" as const,
    expectedOutcome: {
      id: "restart_managed_system_service_outcome",
      description: "The managed system should return to a healthy state after the service restart.",
      criteria: [
        {
          id: "health_ready_after_service_restart",
          description: "Health endpoint should report a healthy state after the restart.",
          checkType: "health_status_is" as const,
          parameters: { expectedState: "healthy" },
        },
      ],
    },
  },
];

const baselineRules = [
  {
    id: "database_connectivity_failure",
    description: "Recover the database before considering the managed-system application.",
    incidentCode: "database_connectivity_failure",
    severity: "high" as const,
    expectedOutcome: "Database readiness and managed-system health return to a healthy state.",
    priority: 100,
    version: 1,
    conditionGroups: [
      {
        id: "database_connectivity_failure_group_1",
        matchMode: "ANY" as const,
        conditions: [
          {
            id: "database_connectivity_failure_postgres_critical",
            signalCode: "postgres_container_state" as const,
            expectedStatus: "critical" as const,
          },
          {
            id: "database_connectivity_failure_connectivity_critical",
            signalCode: "database_connectivity" as const,
            expectedStatus: "critical" as const,
          },
        ],
      },
    ],
    actions: [
      {
        actionId: "restart_postgres_container",
        phase: "proposed" as const,
      },
    ],
  },
  {
    id: "managed_system_service_down",
    description: "Restart the managed-system application only when PostgreSQL remains available.",
    incidentCode: "managed_system_service_down",
    severity: "high" as const,
    expectedOutcome: "The managed system returns to a healthy state.",
    priority: 50,
    version: 1,
    conditionGroups: [
      {
        id: "managed_system_service_down_group_1",
        matchMode: "ANY" as const,
        conditions: [
          {
            id: "managed_system_service_down_reachability_critical",
            signalCode: "managed_system_reachability" as const,
            expectedStatus: "critical" as const,
          },
          {
            id: "managed_system_service_down_health_critical",
            signalCode: "managed_system_health" as const,
            expectedStatus: "critical" as const,
          },
          {
            id: "managed_system_service_down_container_critical",
            signalCode: "managed_system_container_state" as const,
            expectedStatus: "critical" as const,
          },
        ],
      },
      {
        id: "managed_system_service_down_group_2",
        matchMode: "ANY" as const,
        conditions: [
          {
            id: "managed_system_service_down_connectivity_normal",
            signalCode: "database_connectivity" as const,
            expectedStatus: "normal" as const,
          },
          {
            id: "managed_system_service_down_postgres_normal",
            signalCode: "postgres_container_state" as const,
            expectedStatus: "normal" as const,
          },
        ],
      },
    ],
    actions: [
      {
        actionId: "restart_managed_system_service",
        phase: "proposed" as const,
      },
    ],
  },
];

export async function seedCatalogue(prisma: PrismaService): Promise<void> {
  await prisma.executeInTransaction(async (transaction) => {
    for (const rule of safetyRules) {
      await transaction.safetyRule.upsert({
        where: { id: rule.id },
        create: { ...rule, active: true },
        update: {
          description: rule.description,
          checkType: rule.checkType,
          parameters: rule.parameters,
          onFail: rule.onFail,
          active: true,
        },
      });
    }

    for (const action of actions) {
      await transaction.action.upsert({
        where: { id: action.id },
        create: {
          id: action.id,
          name: action.name,
          description: action.description,
          handlerKey: action.handlerKey,
          riskLevel: action.riskLevel,
          active: true,
        },
        update: {
          name: action.name,
          description: action.description,
          handlerKey: action.handlerKey,
          riskLevel: action.riskLevel,
          active: true,
        },
      });

      await transaction.expectedOutcome.upsert({
        where: { actionId: action.id },
        create: {
          id: action.expectedOutcome.id,
          actionId: action.id,
          description: action.expectedOutcome.description,
        },
        update: { description: action.expectedOutcome.description },
      });

      for (const [position, criterion] of action.expectedOutcome.criteria.entries()) {
        await transaction.outcomeCriterion.upsert({
          where: { id: criterion.id },
          create: {
            ...criterion,
            expectedOutcomeId: action.expectedOutcome.id,
            position,
          },
          update: {
            expectedOutcomeId: action.expectedOutcome.id,
            description: criterion.description,
            checkType: criterion.checkType,
            parameters: criterion.parameters,
            position,
          },
        });
      }

      for (const [position, safetyRule] of safetyRules.entries()) {
        await transaction.actionSafetyRule.upsert({
          where: {
            actionId_safetyRuleId: {
              actionId: action.id,
              safetyRuleId: safetyRule.id,
            },
          },
          create: {
            actionId: action.id,
            safetyRuleId: safetyRule.id,
            position,
          },
          update: { position },
        });
      }
    }

    for (const rule of baselineRules) {
      await transaction.baselineRule.upsert({
        where: { id: rule.id },
        create: {
          id: rule.id,
          description: rule.description,
          incidentCode: rule.incidentCode,
          severity: rule.severity,
          expectedOutcome: rule.expectedOutcome,
          priority: rule.priority,
          version: rule.version,
          active: true,
        },
        update: {
          description: rule.description,
          incidentCode: rule.incidentCode,
          severity: rule.severity,
          expectedOutcome: rule.expectedOutcome,
          priority: rule.priority,
          version: rule.version,
          active: true,
        },
      });

      for (const [groupPosition, group] of rule.conditionGroups.entries()) {
        await transaction.baselineRuleConditionGroup.upsert({
          where: { id: group.id },
          create: {
            id: group.id,
            ruleId: rule.id,
            position: groupPosition,
            matchMode: group.matchMode,
          },
          update: {
            ruleId: rule.id,
            position: groupPosition,
            matchMode: group.matchMode,
          },
        });

        for (const [conditionPosition, condition] of group.conditions.entries()) {
          await transaction.baselineRuleCondition.upsert({
            where: { id: condition.id },
            create: {
              id: condition.id,
              groupId: group.id,
              signalCode: condition.signalCode,
              operator: "EQUALS",
              expectedStatus: condition.expectedStatus,
              position: conditionPosition,
            },
            update: {
              groupId: group.id,
              signalCode: condition.signalCode,
              operator: "EQUALS",
              expectedStatus: condition.expectedStatus,
              position: conditionPosition,
            },
          });
        }
      }

      for (const [position, action] of rule.actions.entries()) {
        await transaction.baselineRuleAction.upsert({
          where: {
            baselineRuleId_phase_position: {
              baselineRuleId: rule.id,
              phase: action.phase,
              position,
            },
          },
          create: {
            baselineRuleId: rule.id,
            actionId: action.actionId,
            phase: action.phase,
            position,
          },
          update: { actionId: action.actionId },
        });
      }
    }
  });
}

export const expectedCatalogueCounts = {
  actions: actions.length,
  safetyRules: safetyRules.length,
  expectedOutcomes: actions.length,
  outcomeCriteria: actions.reduce(
    (count, action) => count + action.expectedOutcome.criteria.length,
    0,
  ),
  actionSafetyRules: actions.length * safetyRules.length,
  baselineRules: baselineRules.length,
  baselineConditionGroups: baselineRules.reduce(
    (count, rule) => count + rule.conditionGroups.length,
    0,
  ),
  baselineConditions: baselineRules.reduce(
    (count, rule) =>
      count +
      rule.conditionGroups.reduce((groupCount, group) => groupCount + group.conditions.length, 0),
    0,
  ),
  baselineActions: baselineRules.reduce((count, rule) => count + rule.actions.length, 0),
};
