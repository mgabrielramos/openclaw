import { describe, expect, test } from "vitest";
import {
  normalizeMainKey,
  toAgentRequestSessionKey,
  toAgentStoreSessionKey,
  resolveAgentIdFromSessionKey,
  normalizeAgentId,
  sanitizeAgentId,
  normalizeAccountId,
  buildAgentMainSessionKey,
  buildAgentPeerSessionKey,
  buildGroupHistoryKey,
  resolveThreadSessionKeys,
  DEFAULT_AGENT_ID,
  DEFAULT_MAIN_KEY,
  DEFAULT_ACCOUNT_ID,
} from "./session-key.js";

describe("session-key routing", () => {
  describe("normalizeMainKey", () => {
    test("handles undefined/null/empty", () => {
      expect(normalizeMainKey(undefined)).toBe(DEFAULT_MAIN_KEY);
      expect(normalizeMainKey(null)).toBe(DEFAULT_MAIN_KEY);
      expect(normalizeMainKey("")).toBe(DEFAULT_MAIN_KEY);
      expect(normalizeMainKey("   ")).toBe(DEFAULT_MAIN_KEY);
    });

    test("normalizes string", () => {
      expect(normalizeMainKey("FOO")).toBe("foo");
      expect(normalizeMainKey("  Bar  ")).toBe("bar");
    });
  });

  describe("toAgentRequestSessionKey", () => {
    test("handles empty input", () => {
      expect(toAgentRequestSessionKey(undefined)).toBeUndefined();
      expect(toAgentRequestSessionKey("")).toBeUndefined();
    });

    test("extracts rest from agent key", () => {
      expect(toAgentRequestSessionKey("agent:my-agent:some:key")).toBe("some:key");
    });

    test("returns raw key if not an agent key", () => {
      expect(toAgentRequestSessionKey("some:key")).toBe("some:key");
      expect(toAgentRequestSessionKey("not-agent:foo:bar")).toBe("not-agent:foo:bar");
    });
  });

  describe("toAgentStoreSessionKey", () => {
    test("builds main key if request key is empty or default", () => {
      expect(toAgentStoreSessionKey({ agentId: "ai", requestKey: null })).toBe("agent:ai:main");
      expect(toAgentStoreSessionKey({ agentId: "ai", requestKey: "main" })).toBe("agent:ai:main");
    });

    test("returns raw key if it starts with agent:", () => {
      expect(toAgentStoreSessionKey({ agentId: "ai", requestKey: "agent:other:stuff" })).toBe("agent:other:stuff");
    });

    test("prepends agent:id to subagent keys", () => {
      expect(toAgentStoreSessionKey({ agentId: "ai", requestKey: "subagent:foo" })).toBe("agent:ai:subagent:foo");
    });

    test("prepends agent:id to other keys", () => {
      expect(toAgentStoreSessionKey({ agentId: "ai", requestKey: "custom:key" })).toBe("agent:ai:custom:key");
    });
  });

  describe("resolveAgentIdFromSessionKey", () => {
    test("extracts agent id", () => {
      expect(resolveAgentIdFromSessionKey("agent:bob:stuff")).toBe("bob");
    });

    test("returns default if invalid", () => {
      expect(resolveAgentIdFromSessionKey("invalid")).toBe(DEFAULT_AGENT_ID);
      expect(resolveAgentIdFromSessionKey("")).toBe(DEFAULT_AGENT_ID);
    });
  });

  describe("normalizeAgentId / sanitizeAgentId", () => {
    test("defaults empty input", () => {
      expect(normalizeAgentId(undefined)).toBe(DEFAULT_AGENT_ID);
      expect(sanitizeAgentId(null)).toBe(DEFAULT_AGENT_ID);
    });

    test("validates and lowercases valid ids", () => {
      expect(normalizeAgentId("My-Agent-1")).toBe("my-agent-1");
      expect(sanitizeAgentId("Valid_ID")).toBe("valid_id");
    });

    test("sanitizes invalid chars", () => {
      expect(normalizeAgentId("bad name!")).toBe("bad-name");
      expect(sanitizeAgentId("foo.bar")).toBe("foo-bar");
    });

    test("trims dashes", () => {
        expect(normalizeAgentId("-foo-")).toBe("foo");
    });
  });

  describe("normalizeAccountId", () => {
      test("defaults to default", () => {
          expect(normalizeAccountId(undefined)).toBe(DEFAULT_ACCOUNT_ID);
      });
      test("normalizes valid", () => {
          expect(normalizeAccountId("MyAcct")).toBe("myacct");
      });
      test("sanitizes", () => {
          expect(normalizeAccountId("My.Acct")).toBe("my-acct");
      });
  });

  describe("buildAgentMainSessionKey", () => {
    test("builds key", () => {
      expect(buildAgentMainSessionKey({ agentId: "Ai", mainKey: "Test" })).toBe("agent:ai:test");
    });
  });

  describe("buildAgentPeerSessionKey", () => {
    test("dm scope main (default)", () => {
      expect(buildAgentPeerSessionKey({
        agentId: "ai",
        channel: "wa",
        peerKind: "dm",
        peerId: "123"
      })).toBe("agent:ai:main");
    });

    test("dm scope per-peer", () => {
      expect(buildAgentPeerSessionKey({
        agentId: "ai",
        channel: "wa",
        peerKind: "dm",
        peerId: "123",
        dmScope: "per-peer"
      })).toBe("agent:ai:dm:123");
    });

    test("dm scope per-channel-peer", () => {
      expect(buildAgentPeerSessionKey({
        agentId: "ai",
        channel: "wa",
        peerKind: "dm",
        peerId: "123",
        dmScope: "per-channel-peer"
      })).toBe("agent:ai:wa:dm:123");
    });

    test("dm scope per-account-channel-peer", () => {
        expect(buildAgentPeerSessionKey({
          agentId: "ai",
          channel: "wa",
          peerKind: "dm",
          peerId: "123",
          accountId: "acc1",
          dmScope: "per-account-channel-peer"
        })).toBe("agent:ai:wa:acc1:dm:123");
    });

    test("non-dm peer", () => {
      expect(buildAgentPeerSessionKey({
        agentId: "ai",
        channel: "wa",
        peerKind: "group",
        peerId: "g1"
      })).toBe("agent:ai:wa:group:g1");
    });

    test("identity links resolution", () => {
       const links = { "alice": ["wa:123"] };
       expect(buildAgentPeerSessionKey({
         agentId: "ai",
         channel: "wa",
         peerKind: "dm",
         peerId: "123",
         dmScope: "per-peer",
         identityLinks: links
       })).toBe("agent:ai:dm:alice");
    });
  });

  describe("buildGroupHistoryKey", () => {
      test("builds key", () => {
          expect(buildGroupHistoryKey({
              channel: "wa",
              accountId: "acc",
              peerKind: "group",
              peerId: "g1"
          })).toBe("wa:acc:group:g1");
      });
  });

  describe("resolveThreadSessionKeys", () => {
      test("no thread id", () => {
          const res = resolveThreadSessionKeys({ baseSessionKey: "base" });
          expect(res.sessionKey).toBe("base");
          expect(res.parentSessionKey).toBeUndefined();
      });

      test("with thread id", () => {
          const res = resolveThreadSessionKeys({ baseSessionKey: "base", threadId: "t1" });
          expect(res.sessionKey).toBe("base:thread:t1");
      });

      test("with useSuffix false", () => {
        const res = resolveThreadSessionKeys({ baseSessionKey: "base", threadId: "t1", useSuffix: false });
        expect(res.sessionKey).toBe("base");
      });
  });
});
