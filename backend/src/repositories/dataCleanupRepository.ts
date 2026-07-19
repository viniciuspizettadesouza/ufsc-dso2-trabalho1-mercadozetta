export const cleanupTargets = [
  'sessions',
  'accountTokens',
  'pendingEmailChanges',
  'readNotifications',
  'unreadNotifications',
  'carts',
] as const;

export type CleanupTarget = (typeof cleanupTargets)[number];

export type CleanupPreview = {
  count: number;
  limitReached: boolean;
};

export interface DataCleanupRepository {
  deleteEligible(
    target: CleanupTarget,
    cutoff: Date,
    limit: number,
  ): Promise<number>;
  previewEligible(
    target: CleanupTarget,
    cutoff: Date,
    limit: number,
  ): Promise<CleanupPreview>;
}
