import { describe, expect, it } from "vitest";

import { extractGlobalOptions, parseCliCommand } from "./cli-command.js";

describe("parseCliCommand", () => {
  it("parses lifecycle and configuration commands", () => {
    expect(parseCliCommand(["start"])).toEqual({ name: "start", foreground: false });
    expect(parseCliCommand(["start", "--foreground"])).toEqual({
      name: "start",
      foreground: true,
    });
    expect(parseCliCommand(["stop"])).toEqual({ name: "stop" });
    expect(parseCliCommand(["status"])).toEqual({ name: "status" });
    expect(parseCliCommand(["doctor"])).toEqual({ name: "doctor" });
    expect(parseCliCommand(["config", "path"])).toEqual({ name: "config-path" });
    expect(parseCliCommand(["config", "validate"])).toEqual({
      name: "config-validate",
    });
  });

  it("rejects unknown options instead of ignoring them", () => {
    expect(() => parseCliCommand(["start", "--token=secret"])).toThrow(
      /Unknown start option/,
    );
    expect(() => parseCliCommand(["wat"])).toThrow(/Unknown command/);
  });

  it("extracts the non-secret global configuration path", () => {
    expect(extractGlobalOptions(["--config", "/tmp/config.jsonc", "doctor"])).toEqual({
      commandArgs: ["doctor"],
      configPath: "/tmp/config.jsonc",
    });
    expect(() => extractGlobalOptions(["--config"])).toThrow(/requires a path/);
  });
});
