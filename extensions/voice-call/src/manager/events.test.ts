import { describe, expect, it } from "vitest";

import { processEvent } from "./events.js";
import type { CallManagerContext } from "./context.js";
import { VoiceCallConfigSchema, type VoiceCallConfig } from "../config.js";
import type {
  NormalizedEvent,
  HangupCallInput,
  PlayTtsInput,
  InitiateCallInput,
  InitiateCallResult,
  StartListeningInput,
  StopListeningInput,
  WebhookContext,
  WebhookVerificationResult,
  ProviderWebhookParseResult
} from "../types.js";
import type { VoiceCallProvider } from "../providers/base.js";

class FakeProvider implements VoiceCallProvider {
  readonly name = "plivo" as const;
  readonly playTtsCalls: PlayTtsInput[] = [];
  readonly hangupCalls: HangupCallInput[] = [];

  verifyWebhook(_ctx: WebhookContext): WebhookVerificationResult { return { ok: true }; }
  parseWebhookEvent(_ctx: WebhookContext): ProviderWebhookParseResult { return { events: [], statusCode: 200 }; }
  async initiateCall(_input: InitiateCallInput): Promise<InitiateCallResult> { return { providerCallId: "request-uuid", status: "initiated" }; }
  async hangupCall(input: HangupCallInput): Promise<void> { this.hangupCalls.push(input); }
  async playTts(input: PlayTtsInput): Promise<void> { this.playTtsCalls.push(input); }
  async startListening(_input: StartListeningInput): Promise<void> {}
  async stopListening(_input: StopListeningInput): Promise<void> {}
}

function createMockContext(config: VoiceCallConfig): CallManagerContext {
  return {
    activeCalls: new Map(),
    providerCallIdMap: new Map(),
    processedEventIds: new Set(),
    provider: new FakeProvider(),
    config,
    storePath: "/tmp/store", // Dummy path
    webhookUrl: "https://example.com/webhook",
    transcriptWaiters: new Map(),
    maxDurationTimers: new Map(),
  };
}

describe("processEvent", () => {
  it("hangs up inbound call if not in allowlist", async () => {
    const config = VoiceCallConfigSchema.parse({
      enabled: true,
      inboundPolicy: "allowlist",
      allowFrom: ["+15551234567"],
      provider: "plivo", // to match FakeProvider name check if any
      // schema requires some fields
      fromNumber: "+15550000000",
    });

    const ctx = createMockContext(config);
    const provider = ctx.provider as FakeProvider;

    const event: NormalizedEvent = {
      id: "evt-rejected",
      type: "call.initiated",
      callId: "call-uuid-external",
      providerCallId: "provider-call-uuid-rejected",
      timestamp: Date.now(),
      direction: "inbound",
      from: "+15559999999", // Not allowed
      to: "+15550000000",
    };

    processEvent(ctx, event);

    // Wait for async hangup
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(provider.hangupCalls).toHaveLength(1);
    expect(provider.hangupCalls[0]).toMatchObject({
      providerCallId: "provider-call-uuid-rejected",
      reason: "hangup-bot",
    });

    // Check call was not created
    expect(ctx.activeCalls.size).toBe(0);
  });
});
