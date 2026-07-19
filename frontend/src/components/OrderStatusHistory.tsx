export type OrderStatusHistoryEntry = {
  status: string;
  actor: string;
  changedAt: string | Date;
};

export function OrderStatusHistory({
  orderId,
  entries,
}: {
  orderId: string;
  entries?: OrderStatusHistoryEntry[];
}) {
  return (
    <ol aria-label={`Status history for order ${orderId}`}>
      {entries?.map((entry) => (
        <li key={`${entry.status}-${entry.changedAt}`}>
          {entry.status} by {entry.actor} at{' '}
          {new Date(entry.changedAt).toLocaleString()}
        </li>
      ))}
    </ol>
  );
}
