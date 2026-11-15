import { useEffect, type DependencyList } from 'react'
import { subscribe, type DbTable } from '../api'
import { useAsync, type AsyncState } from './useAsync'

/**
 * `useAsync`, который сам перезагружает данные, когда меняются указанные таблицы —
 * в этой вкладке или в соседней (клиент оформил заказ → список в админке обновился).
 *
 *   const { data: orders, loading, error } = useApiQuery(() => listOrders({ status }), [status], ['orders'])
 *
 * `tables` должен быть постоянным набором (литерал массива подойдёт).
 */
export function useApiQuery<T>(fn: () => Promise<T>, deps: DependencyList, tables: DbTable[]): AsyncState<T> {
  const state = useAsync(fn, deps)
  const { reload } = state
  const tablesKey = tables.join(',')

  useEffect(() => {
    const watched = tablesKey.split(',')
    return subscribe((changed) => {
      if (changed.some((table) => watched.includes(table))) reload()
    })
  }, [tablesKey, reload])

  return state
}
