const DEFAULT_PAGE_SIZE_OPTIONS = [15, 25, 50, 100]

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 pt-1 text-sm">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <span>Vis</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="input w-auto py-1"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>{total > 0 ? `${from}–${to} av ${total}` : 'Ingen kamper'}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
        >
          Forrige
        </button>
        <span className="text-xs text-slate-400 px-1">{page + 1} / {totalPages}</span>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
        >
          Neste
        </button>
      </div>
    </div>
  )
}
