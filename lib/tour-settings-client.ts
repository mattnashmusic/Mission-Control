export type EditableTourSettingField = "plannedAdBudget" | "blendedCpt";

export async function saveTourSetting(
  field: EditableTourSettingField,
  value: number
) {
  const res = await fetch("/api/tour-settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      [field]: value,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to save setting");
  }

  return res.json();
}