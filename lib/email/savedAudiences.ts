// Saved audiences now live server-side (see app/api/email/saved-audiences),
// so they persist across devices and browsers instead of disappearing
// whenever local storage gets cleared.

export type SavedAudience = {
  id: string;
  name: string;
  city: string;
  country: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  showId: string | null;
  createdAt: string;
};

export type NewSavedAudience = {
  name: string;
  city: string;
  country?: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  showId?: string | null;
};

export async function getSavedAudiences(): Promise<SavedAudience[]> {
  const response = await fetch("/api/email/saved-audiences", { cache: "no-store" });
  if (!response.ok) return [];

  const json = await response.json();
  return Array.isArray(json?.audiences) ? json.audiences : [];
}

export async function saveAudience(audience: NewSavedAudience): Promise<SavedAudience> {
  const response = await fetch("/api/email/saved-audiences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(audience),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || "Failed to save audience");
  }

  return json.audience as SavedAudience;
}

export async function deleteAudience(id: string): Promise<void> {
  const response = await fetch("/api/email/saved-audiences", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error || "Failed to delete audience");
  }
}
