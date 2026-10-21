import { Prisma } from "@prisma/client";

/** Public DTO boundary: snake_case fields, exact decimal strings, no raw bigint. */
export function toApi(value: unknown, key = ""): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") {
    const id = Number(value);
    if (!Number.isSafeInteger(id)) throw new Error("ID exceeds supported safe integer range");
    return id;
  }
  if (value instanceof Prisma.Decimal) return value.toFixed(2);
  if (value instanceof Date)
    return key === "birthDate" ? value.toISOString().slice(0, 10) : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toApi(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
        toApi(item, field),
      ]),
    );
  }
  return value;
}
