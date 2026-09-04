import { ChevronLeft, ChevronRight } from 'lucide-react'

const TABLE_PAGE_SIZE = 10

export default function TablePagination({ page, totalPages, totalItems, pageSize = TABLE_PAGE_SIZE, onPageChange, label = 'records' }) {
  if (!totalItems) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalItems)
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3"><p className="text-xs text-slate-400">Showing {first}–{last} of {totalItems} {label}</p><div className="flex items-center gap-2"><button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} /></button><span className="min-w-16 text-center text-xs font-semibold text-slate-600">{page} / {totalPages}</span><button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} /></button></div></div>
}
