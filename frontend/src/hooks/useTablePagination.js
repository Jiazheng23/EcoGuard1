import { useCallback, useState } from 'react'

export const TABLE_PAGE_SIZE = 10

export default function useTablePagination(items, pageSize = TABLE_PAGE_SIZE) {
  const [requestedPage, setRequestedPage] = useState(1)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const start = (page - 1) * pageSize
  const setPage = useCallback((nextPage) => {
    setRequestedPage(Math.max(1, Math.min(nextPage, totalPages)))
  }, [totalPages])

  return {
    page,
    totalPages,
    totalItems,
    pageItems: items.slice(start, start + pageSize),
    setPage,
  }
}
