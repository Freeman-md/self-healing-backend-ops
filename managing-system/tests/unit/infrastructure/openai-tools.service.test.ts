import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAIService, type OpenAIInvocationTelemetry } from "@/infrastructure/openai";

test("tool provider normalizes calls, continues responses and records every successful or failed turn", async () => {
  const telemetry: OpenAIInvocationTelemetry[] = [];

  const requests: Array<Record<string, unknown>> = [];

  const service = new OpenAIService(
    undefined,
    {
      async recordOpenAIInvocation(value) {
        telemetry.push(value);
      },
    },
    Date.now,
    {
      responses: {
        async create(input: Record<string, unknown>, options: { maxRetries: number }) {
          assert.equal(options.maxRetries, 0);
          requests.push(input);
          if (requests.length === 3) {
            throw new Error("provider failure");
          }

          return {
            id: `response-${requests.length}`,
            output: [
              { type: "reasoning" },
              { type: "function_call", call_id: "call-1", name: "record", arguments: "{}" },
            ],
            usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
          };
        },
      },
    } as never,
  );

  const common = {
    systemPrompt: "bounded",
    tools: [
      {
        name: "record",
        description: "record",
        parameters: { type: "object", additionalProperties: false, properties: {} },
      },
    ],
    telemetryContext: { operation: "recovery_planning" as const, trialRecordId: "trial" },
  };

  const initial = await service.createToolConversation({ ...common, userPrompt: "evidence" });

  assert.deepEqual(initial.calls, [{ callId: "call-1", name: "record", arguments: "{}" }]);
  await service.continueToolConversation({
    ...common,
    conversationId: initial.conversationId,
    outputs: [{ callId: "call-1", output: "accepted" }],
  });
  await assert.rejects(
    service.continueToolConversation({ ...common, conversationId: "response-2", outputs: [] }),
  );
  assert.equal(requests[0].tool_choice, "required");
  assert.equal(requests[0].parallel_tool_calls, false);
  assert.equal((requests[0].tools as Array<{ strict: boolean }>)[0].strict, true);
  assert.equal(requests[1].previous_response_id, "response-1");
  assert.deepEqual(requests[1].input, [
    { type: "function_call_output", call_id: "call-1", output: "accepted" },
  ]);
  assert.deepEqual(
    telemetry.map((entry) => entry.status),
    ["succeeded", "succeeded", "failed"],
  );
  assert.equal(telemetry[0].totalTokens, 5);
  assert.equal(telemetry[2].error, "Tool conversation provider request failed.");
});
