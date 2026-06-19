/** Shared artist title/status labels (client-safe — no prisma runtime import). */
export type ArtistStatus = "CO_OWNER" | "RESIDENT" | "APPRENTICE";

export const ARTIST_STATUS_LABEL: Record<ArtistStatus, string> = {
  CO_OWNER: "Co-owner",
  RESIDENT: "Resident Artist",
  APPRENTICE: "Apprentice",
};

export const ARTIST_STATUS_OPTIONS: ReadonlyArray<{ value: ArtistStatus; label: string }> = [
  { value: "CO_OWNER", label: "Co-owner" },
  { value: "RESIDENT", label: "Resident Artist" },
  { value: "APPRENTICE", label: "Apprentice" },
];

export function artistStatusLabel(status: ArtistStatus): string {
  return ARTIST_STATUS_LABEL[status] ?? status;
}
