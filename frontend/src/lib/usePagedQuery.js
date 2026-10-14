import { useMemo } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

const identity = (data) => data

/**
 * Offset pagination ("infinite loading") on top of TanStack's useInfiniteQuery.
 *
 *   const list = usePagedQuery({
 *     queryKey: ['employees', 'page', filters],     // changing filters starts again at page one
 *     fetchPage: (page) => employeesApi.page({ ...filters, ...page }),  // page = { limit, offset }
 *   })
 *   list.items  list.total  list.hasNextPage  list.fetchNextPage()  list.isFetchingNextPage
 *
 * `fetchPage` must resolve to { data, total } (see api.page). When a page's
 * `data` is an object rather than the rows array, pass `getItems` (a stable,
 * module-level function) to pick the rows; `firstPage` exposes the rest of the
 * newest first page (e.g. unread counters).
 */
export function usePagedQuery({ queryKey, fetchPage, pageSize = 25, getItems = identity, ...options }) {
  const query = useInfiniteQuery({
    queryKey: [...queryKey, { pageSize }],
    queryFn: ({ pageParam }) => fetchPage({ limit: pageSize, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages, lastOffset) => {
      const received = getItems(lastPage.data)?.length ?? 0
      const loaded = lastOffset + received
      if (received < pageSize) return undefined
      if (lastPage.total != null && loaded >= lastPage.total) return undefined
      return loaded
    },
    placeholderData: keepPreviousData,
    ...options,
  })

  const pages = query.data?.pages
  const items = useMemo(() => {
    if (!pages) return []
    // Rows can shift between pages when data changes while scrolling (offset paging): drop repeats.
    const seen = new Set()
    const out = []
    for (const page of pages) {
      for (const row of getItems(page.data) || []) {
        const key = row?.id ?? row
        if (seen.has(key)) continue
        seen.add(key)
        out.push(row)
      }
    }
    return out
  }, [pages, getItems])

  const lastTotal = pages?.length ? pages[pages.length - 1].total : null
  return {
    ...query,
    items,
    total: lastTotal ?? items.length,
    firstPage: pages?.[0]?.data,
  }
}
