import { createHash } from "node:crypto";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)])
    );
  }

  return value;
}

export function digest(value: unknown): string {
  const canonical = JSON.stringify(normalize(value));
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
