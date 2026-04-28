"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createShippingCostEntry(formData: FormData) {
  const countryCode = String(formData.get("countryCode") || "").trim();
  const countryName = String(formData.get("countryName") || "").trim();
  const cd1OnlyCostRaw = String(formData.get("cd1OnlyCost") || "").trim();
  const cdPackageCost = Number(formData.get("cdPackageCost"));
  const vinylCost = Number(formData.get("vinylCost"));
  const vinylIncludesCds = String(formData.get("vinylIncludesCds") || "") === "on";
  const effectiveFromRaw = String(formData.get("effectiveFrom") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!countryCode || !countryName || !effectiveFromRaw) {
    throw new Error("Missing required shipping fields.");
  }

  if (!Number.isFinite(cdPackageCost) || cdPackageCost < 0) {
    throw new Error("CD package cost must be a valid positive number.");
  }

  if (!Number.isFinite(vinylCost) || vinylCost < 0) {
    throw new Error("Vinyl cost must be a valid positive number.");
  }

  const cd1OnlyCost =
    cd1OnlyCostRaw === "" ? null : Number(cd1OnlyCostRaw);

  if (
    cd1OnlyCost !== null &&
    (!Number.isFinite(cd1OnlyCost) || cd1OnlyCost < 0)
  ) {
    throw new Error("CD1 only cost must be a valid positive number.");
  }

  await prisma.shippingCostEntry.create({
    data: {
      countryCode,
      countryName,
      cd1OnlyCost,
      cdPackageCost,
      vinylCost,
      vinylIncludesCds,
      effectiveFrom: new Date(`${effectiveFromRaw}T00:00:00.000Z`),
      notes: notes || null,
    },
  });

  revalidatePath("/fsh/shipping");
}

export async function deleteShippingCostEntry(formData: FormData) {
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing shipping entry ID.");
  }

  await prisma.shippingCostEntry.delete({
    where: { id },
  });

  revalidatePath("/fsh/shipping");
}