export type DisposableAccountStateCounts = {
  carts: number;
  watchlistEntries: number;
  notifications: number;
};

export interface AccountLifecycleRepository {
  hasActiveOrders(tenantId: string, userId: string): Promise<boolean>;
  archiveOwnedListings(
    tenantId: string,
    sellerId: string,
    now: Date,
  ): Promise<number>;
  deleteDisposableState(
    tenantId: string,
    userId: string,
  ): Promise<DisposableAccountStateCounts>;
}
