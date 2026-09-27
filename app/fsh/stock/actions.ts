"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PRODUCT_ITEMS } from "@/lib/products";

export async function createStockCount(formData: FormData) {
  const itemKey = String(formData.get("itemKey") || "").trim();
  const quantityRaw = formData.get("quantity");
  const countedAtRaw = String(formData.get("countedAt") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  const item = PRODUCT_ITEMS.find((p) => p.itemKey === itemKey);

  if (!item || !countedAtRaw) {
    throw new Error("Missing required stock count fields.");
  }

  const quantity = Number(quantityRaw);

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Quantity must be a valid non-negative number.");
  }

  await prisma.stockCountEntry.create({
    data: {
      itemKey: item.itemKey,
      itemName: item.itemName,
      quantity: Math.round(quantity),
      countedAt: new Date(`${countedAtRaw}T00:00:00.000Z`),
      notes: notes || null,
    },
  });

  revalidatePath("/fsh/stock");
  revalidatePath("/fsh");
}

export async function deleteStockCount(formData: FormData) {
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing stock count entry ID.");
  }

  await prisma.stockCountEntry.delete({ where: { id } });

  revalidatePath("/fsh/stock");
  revalidatePath("/fsh");
}

export async function upsertReorderSetting(formData: FormData) {
  const itemKey = String(formData.get("itemKey") || "").trim();
  const productionDays = Number(formData.get("productionDays"));
  const shippingDays = Number(formData.get("shippingDays"));
  const bufferDays = Number(formData.get("bufferDays"));

  const item = PRODUCT_ITEMS.find((p) => p.itemKey === itemKey);

  if (!item) {
    throw new Error("Unknown product item.");
  }

  if (
    !Number.isFinite(productionDays) ||
    productionDays < 0 ||
    !Number.isFinite(shippingDays) ||
    shippingDays < 0 ||
    !Number.isFinite(bufferDays) ||
    bufferDays < 0
  ) {
    throw new Error("Lead time values must be valid non-negative numbers.");
  }

  await prisma.reorderSetting.upsert({
    where: { itemKey: item.itemKey },
    create: {
      itemKey: item.itemKey,
      itemName: item.itemName,
      productionDays: Math.round(productionDays),
      shippingDays: Math.round(shippingDays),
      bufferDays: Math.round(bufferDays),
    },
    update: {
      productionDays: Math.round(productionDays),
      shippingDays: Math.round(shippingDays),
      bufferDays: Math.round(bufferDays),
    },
  });

  revalidatePath("/fsh/stock");
  revalidatePath("/fsh");
}
