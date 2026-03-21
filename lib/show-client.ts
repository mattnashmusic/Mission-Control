export type EditableShowField =
  | "capacity"
  | "ticketPrice"
  | "ticketSales"
  | "metaSpend"
  | "venueHire"
  | "production"
  | "hotelPetrolMisc";

export async function saveShowField(
  id: string,
  field: EditableShowField,
  value: number
) {
  const res = await fetch("/api/shows", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
      [field]: value,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to save");
  }

  return res.json();
}