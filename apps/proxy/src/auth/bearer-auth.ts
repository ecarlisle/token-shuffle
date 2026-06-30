import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function hasValidBearerToken(
  authorization: string | undefined,
  expectedToken: string,
): boolean {
  if (authorization === undefined || !authorization.startsWith("Bearer ")) {
    return false;
  }

  const suppliedToken = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(suppliedToken), digest(expectedToken));
}
