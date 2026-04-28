"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createCostEntry(formData: FormData) {
  const itemKey = String(formData.get("itemKey") || "").trim();
  const itemName = String(formData.get("itemName") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const unitCost = Number(formData.get("unitCost"));
  const effectiveFromRaw = String(formData.get("effectiveFrom") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!itemKey || !itemName || !category || !effectiveFromRaw) {
    throw new Error("Missing required COGS fields.");
  }

  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new Error("Unit cost must be a valid positive number.");
  }

  await prisma.cogsCostEntry.create({
    data: {
      itemKey,
      itemName,
      category,
      unitCost,
      effectiveFrom: new Date(`${effectiveFromRaw}T00:00:00.000Z`),
      notes: notes || null,
    },
  });

  revalidatePath("/fsh/cogs");
}

export async function deleteCostEntry(formData: FormData) {
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing COGS entry ID.");
  }

  await prisma.cogsCostEntry.delete({
    where: { id },
  });

  revalidatePath("/fsh/cogs");
}