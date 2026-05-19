import { Prisma, type PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";

export type TipEntityType =
  | "MATCH_TIP"
  | "GROUP_RANKING"
  | "KNOCKOUT_ADVANCERS"
  | "SPECIAL_TIP";

type JsonValue = Prisma.InputJsonValue | null;

type DbClient = PrismaClient | Prisma.TransactionClient;

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!isEqual(ao[k], bo[k])) return false;
  }
  return true;
}

export async function recordTipChange({
  userId,
  entityType,
  entityKey,
  oldValue,
  newValue,
  client,
}: {
  userId: string;
  entityType: TipEntityType;
  entityKey: string;
  oldValue: JsonValue;
  newValue: JsonValue;
  client?: DbClient;
}): Promise<void> {
  if (isEqual(oldValue, newValue)) return;
  const c = client ?? db;
  await c.tipChangeLog.create({
    data: {
      userId,
      entityType,
      entityKey,
      oldValue: oldValue ?? Prisma.JsonNull,
      newValue: newValue ?? Prisma.JsonNull,
    },
  });
}
