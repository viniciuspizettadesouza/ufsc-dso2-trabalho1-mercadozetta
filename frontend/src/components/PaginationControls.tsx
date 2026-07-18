import type { PageInfo } from '@/pagination';
import { Button } from '@/components/Button';

export default function PaginationControls({
  page,
  onPage,
  label,
}: {
  page: PageInfo;
  onPage: (offset: number) => void;
  label: string;
}) {
  if (page.total <= page.limit) return null;
  return (
    <nav aria-label={label} className="mt-5 flex items-center justify-between">
      <Button
        type="button"
        disabled={page.offset === 0}
        onClick={() => onPage(Math.max(0, page.offset - page.limit))}
      >
        Previous
      </Button>
      <span>
        {page.offset + 1}–{Math.min(page.offset + page.limit, page.total)} of{' '}
        {page.total}
      </span>
      <Button
        type="button"
        disabled={!page.hasMore}
        onClick={() => onPage(page.offset + page.limit)}
      >
        Next
      </Button>
    </nav>
  );
}
