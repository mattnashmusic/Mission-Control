export type SavedAudience = {
  id: string;
  name: string;
  city: string;
  radiusKm: number;
  createdAt: number;
};

const STORAGE_KEY = "saved_audiences";

export function getSavedAudiences(): SavedAudience[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as SavedAudience[];
  } catch {
    return [];
  }
}

export function saveAudience(audience: SavedAudience) {
  const current = getSavedAudiences();
  const updated = [audience, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteAudience(id: string) {
  const current = getSavedAudiences();
  const updated = current.filter((audience) => audience.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}