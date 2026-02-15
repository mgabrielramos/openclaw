import { describe, expect, it } from "vitest";
import { parseInlineDirectives } from "./directive-tags.js";

describe("parseInlineDirectives", () => {
  it("handles empty or undefined input", () => {
    const expected = {
      text: "",
      audioAsVoice: false,
      replyToCurrent: false,
      hasAudioTag: false,
      hasReplyTag: false,
      replyToId: undefined,
      replyToExplicitId: undefined,
    };
    expect(parseInlineDirectives(undefined)).toEqual(expected);
    expect(parseInlineDirectives("")).toEqual(expected);
  });

  it("parses and strips audio tag", () => {
    const result = parseInlineDirectives("Hello [[audio_as_voice]] world");
    expect(result.audioAsVoice).toBe(true);
    expect(result.hasAudioTag).toBe(true);
    expect(result.text).toBe("Hello world");
  });

  it("parses audio tag case insensitive", () => {
    const result = parseInlineDirectives("Hello [[Audio_As_Voice]] world");
    expect(result.audioAsVoice).toBe(true);
    expect(result.text).toBe("Hello world");
  });

  it("does not strip audio tag when configured", () => {
    const result = parseInlineDirectives("Hello [[audio_as_voice]]", { stripAudioTag: false });
    expect(result.audioAsVoice).toBe(true);
    expect(result.text).toBe("Hello [[audio_as_voice]]");
  });

  it("parses and strips reply_to_current", () => {
    const result = parseInlineDirectives("Response [[reply_to_current]]", { currentMessageId: "123" });
    expect(result.replyToCurrent).toBe(true);
    expect(result.hasReplyTag).toBe(true);
    expect(result.replyToId).toBe("123");
    expect(result.text).toBe("Response");
  });

  it("parses and strips reply_to: <id>", () => {
    const result = parseInlineDirectives("Response [[reply_to: 456]]");
    expect(result.replyToExplicitId).toBe("456");
    expect(result.replyToId).toBe("456");
    expect(result.hasReplyTag).toBe(true);
    expect(result.text).toBe("Response");
  });

  it("prioritizes explicit reply id over current", () => {
    const result = parseInlineDirectives("[[reply_to_current]] [[reply_to: 789]]", { currentMessageId: "123" });
    expect(result.replyToId).toBe("789");
    expect(result.replyToExplicitId).toBe("789");
    expect(result.replyToCurrent).toBe(true); // detected both
  });

  it("prioritizes explicit reply id over current (order swapped)", () => {
    const result = parseInlineDirectives("[[reply_to: 789]] [[reply_to_current]]", { currentMessageId: "123" });
    expect(result.replyToId).toBe("789");
    expect(result.replyToExplicitId).toBe("789");
    expect(result.replyToCurrent).toBe(true);
  });

  it("does not strip reply tags when configured", () => {
    const result = parseInlineDirectives("Hello [[reply_to: 123]]", { stripReplyTags: false });
    expect(result.replyToExplicitId).toBe("123");
    expect(result.text).toBe("Hello [[reply_to: 123]]");
  });

  it("normalizes whitespace", () => {
    const text = "  Line 1   \n   Line 2  ";
    const result = parseInlineDirectives(text);
    expect(result.text).toBe("Line 1\nLine 2");

    const text2 = "  Line 1   \n\n   Line 2  ";
    const result2 = parseInlineDirectives(text2);
    expect(result2.text).toBe("Line 1\n\nLine 2");
  });

  it("handles complex mixed tags", () => {
    const input = "  [[audio_as_voice]]  Hello   [[reply_to:  abc-123 ]]  World  ";
    const result = parseInlineDirectives(input);
    expect(result.audioAsVoice).toBe(true);
    expect(result.replyToId).toBe("abc-123");
    expect(result.text).toBe("Hello World");
  });
});
