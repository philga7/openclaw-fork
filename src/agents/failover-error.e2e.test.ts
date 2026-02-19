import { describe, expect, it } from "vitest";
import {
  coerceToFailoverError,
  describeFailoverError,
  isTimeoutError,
  resolveFailoverReasonFromError,
} from "./failover-error.js";

describe("failover-error", () => {
  it("infers failover reason from HTTP status", () => {
    expect(resolveFailoverReasonFromError({ status: 402 })).toBe("billing");
    expect(resolveFailoverReasonFromError({ statusCode: "429" })).toBe("rate_limit");
    expect(resolveFailoverReasonFromError({ status: 403 })).toBe("auth");
    expect(resolveFailoverReasonFromError({ status: 408 })).toBe("timeout");
    expect(resolveFailoverReasonFromError({ status: 400 })).toBe("format");
  });

  it("infers format errors from error messages", () => {
    expect(
      resolveFailoverReasonFromError({
        message: "invalid request format: messages.1.content.1.tool_use.id",
      }),
    ).toBe("format");
  });

  it("infers timeout from common node error codes", () => {
    expect(resolveFailoverReasonFromError({ code: "ETIMEDOUT" })).toBe("timeout");
    expect(resolveFailoverReasonFromError({ code: "ECONNRESET" })).toBe("timeout");
  });

  it("infers timeout from abort stop-reason messages", () => {
    expect(resolveFailoverReasonFromError({ message: "Unhandled stop reason: abort" })).toBe(
      "timeout",
    );
    expect(resolveFailoverReasonFromError({ message: "stop reason: abort" })).toBe("timeout");
    expect(resolveFailoverReasonFromError({ message: "reason: abort" })).toBe("timeout");
  });

  it("treats AbortError reason=abort as timeout", () => {
    const err = Object.assign(new Error("aborted"), {
      name: "AbortError",
      reason: "reason: abort",
    });
    expect(isTimeoutError(err)).toBe(true);
  });

  it("coerces failover-worthy errors into FailoverError with metadata", () => {
    const err = coerceToFailoverError("credit balance too low", {
      provider: "anthropic",
      model: "claude-opus-4-5",
    });
    expect(err?.name).toBe("FailoverError");
    expect(err?.reason).toBe("billing");
    expect(err?.status).toBe(402);
    expect(err?.provider).toBe("anthropic");
    expect(err?.model).toBe("claude-opus-4-5");
  });

  it("coerces format errors with a 400 status", () => {
    const err = coerceToFailoverError("invalid request format", {
      provider: "google",
      model: "cloud-code-assist",
    });
    expect(err?.reason).toBe("format");
    expect(err?.status).toBe(400);
  });

  it("classifies Ollama Error with .status property as format", () => {
    const err = Object.assign(new Error("Ollama API error 400: invalid tool call in messages"), {
      status: 400,
    });
    expect(resolveFailoverReasonFromError(err)).toBe("format");
    const failover = coerceToFailoverError(err, { provider: "ollama", model: "glm-5" });
    expect(failover?.reason).toBe("format");
    expect(failover?.status).toBe(400);
    expect(failover?.provider).toBe("ollama");
  });

  it("classifies Ollama 400 error by message when status property is absent", () => {
    expect(resolveFailoverReasonFromError({ message: "Ollama API error 400: bad request" })).toBe(
      "format",
    );
  });

  it("classifies 'invalid tool call' message as format", () => {
    expect(resolveFailoverReasonFromError({ message: "invalid tool call: missing name" })).toBe(
      "format",
    );
  });

  it("classifies 'malformed tool' message as format", () => {
    expect(
      resolveFailoverReasonFromError({ message: "malformed assistant tool call in history" }),
    ).toBe("format");
  });

  it("describes non-Error values consistently", () => {
    const described = describeFailoverError(123);
    expect(described.message).toBe("123");
    expect(described.reason).toBeUndefined();
  });
});
