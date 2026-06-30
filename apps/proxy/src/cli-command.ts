import { ConfigError } from "./config/load-config.js";

export type CliCommand =
  | { readonly name: "start"; readonly foreground: boolean }
  | { readonly name: "stop" | "status" | "doctor" }
  | { readonly name: "config-path" | "config-validate" }
  | { readonly name: "help" };

export function extractGlobalOptions(args: readonly string[]): {
  readonly commandArgs: readonly string[];
  readonly configPath?: string;
} {
  const commandArgs: string[] = [];
  let configPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--config") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new ConfigError("--config requires a path.");
      }
      if (configPath !== undefined) throw new ConfigError("--config may be supplied only once.");
      configPath = value;
      index += 1;
    } else {
      commandArgs.push(argument ?? "");
    }
  }
  return configPath === undefined ? { commandArgs } : { commandArgs, configPath };
}

export function parseCliCommand(args: readonly string[]): CliCommand {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    return { name: "help" };
  }
  if (args[0] === "start") {
    const unknown = args.slice(1).filter((argument) => argument !== "--foreground");
    if (unknown.length > 0) throw new ConfigError(`Unknown start option: ${unknown[0]}`);
    return { name: "start", foreground: args.includes("--foreground") };
  }
  if (args[0] === "stop" || args[0] === "status" || args[0] === "doctor") {
    if (args.length !== 1) throw new ConfigError(`Unexpected argument: ${args[1]}`);
    return { name: args[0] };
  }
  if (args[0] === "config" && args[1] === "path" && args.length === 2) {
    return { name: "config-path" };
  }
  if (args[0] === "config" && args[1] === "validate" && args.length === 2) {
    return { name: "config-validate" };
  }
  throw new ConfigError(`Unknown command: ${args.join(" ")}`);
}
