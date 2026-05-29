"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export type SaveProfileResult =
  | { status: "ok"; name: string }
  | { status: "unauth" }
  | { status: "tooShort" }
  | { status: "tooLong" }
  | { status: "error"; message: string };

const NAME_MIN = 1;
const NAME_MAX = 50;

export async function saveProfileAction(
  _prev: SaveProfileResult | null,
  formData: FormData
): Promise<SaveProfileResult> {
  try {
    return await saveProfile(formData);
  } catch (err) {
    console.error("[saveProfileAction]", err);
    return {
      status: "error",
      message: "Něco se pokazilo při ukládání. Zkus to prosím za chvíli znovu.",
    };
  }
}

async function saveProfile(formData: FormData): Promise<SaveProfileResult> {
  const session = await auth();
  if (!session?.user?.id) return { status: "unauth" };

  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.trim() : "";

  if (name.length < NAME_MIN) return { status: "tooShort" };
  if (name.length > NAME_MAX) return { status: "tooLong" };

  await db.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  // Headere a další server komponenty zobrazují jméno — invalidate je
  revalidatePath("/", "layout");

  return { status: "ok", name };
}
