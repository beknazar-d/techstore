import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getShopStats } from '../../api/stats'
import { formatPrice } from '../../utils/format'
import { PageHeader, Section } from '../components/AdminBlocks'
import { StatsChart } from '../components/StatsChart'
import { ExpensesSection } from '../components/ExpensesSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApiQuery } from '../../hooks/useApiQuery'
import { shop } from '../../config/shop'
import { msg } from '../../i18n'
import styles from './StatsPage.module.css'

const PERIODS = [{ value: 7 }, { value: 30 }, { value: 90 }] as const

type PeriodValue = typeof PERIODS[number]['value']

export function StatsPage() {
  const t = msg().adminStats
  const [period, setPeriod] = useState<PeriodValue>(30)
  const { data: stats, loading } = useApiQuery(
    () => getShopStats(period),
    [period],
    ['orders', 'products', 'tradeIns']
  )

  if (loading || !stats) {
    return (
      <div className={styles.page}>
        <div className={styles.loader}>
          <div className={styles.spinner} />
        </div>
      </div>
    )
  }


  return (
    <div className={styles.page}>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
      />

      {/* Переключатели периода */}
      <div className={styles.periodFilters}>
        {PERIODS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={styles.periodButton}
            data-active={period === item.value}
            onClick={() => setPeriod(item.value)}
          >
            {t.days(item.value)}
          </button>
        ))}
      </div>

      {/* KPI-плитки */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{t.revenue}</div>
          <div className={styles.kpiValue}>{formatPrice(stats.revenue)}</div>
          <div className={styles.kpiSub}>
            {t.completed(stats.ordersCompleted)}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{t.profit}</div>
          <div className={styles.kpiValue}>{formatPrice(stats.profit)}</div>
          <div className={styles.kpiSub}>
            {stats.marginPercent !== null
              ? t.margin(stats.marginPercent)
              : t.noCost
            }
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{t.averageCheck}</div>
          <div className={styles.kpiValue}>
            {stats.averageCheck ? formatPrice(stats.averageCheck) : '—'}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{t.orders}</div>
          <div className={styles.kpiValue}>{stats.ordersTotal}</div>
          <div className={styles.kpiSub}>
            {t.cancelled(stats.ordersCancelled, stats.cancelRatePercent ?? 0)}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{t.inProgress}</div>
          <div className={styles.kpiValue}>{stats.ordersInProgress}</div>
          <div className={styles.kpiSub}>
            {t.inProgressValue(formatPrice(stats.inProgressValue))}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Trade-in</div>
          <div className={styles.kpiValue}>{stats.tradeInsTotal}</div>
          <div className={styles.kpiSub}>
            {t.tradeInAccepted(stats.tradeInsAccepted)}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{t.sources}</div>
          <div className={styles.kpiValue}>
            {stats.ordersBySource.site} / {stats.ordersBySource.telegram}
          </div>
          <div className={styles.kpiSub}>{t.sourcesSub}</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>{t.inStock}</div>
          <div className={styles.kpiValue}>{formatPrice(stats.inventory.costValue)}</div>
          <div className={styles.kpiSub}>
            {t.inStockSub(stats.inventory.units)}
          </div>
        </div>
      </div>

      {/* График */}
      <Section title={t.chartTitle}>
        <StatsChart days={stats.daily} />
        {stats.revenueWithoutCost > 0 && (
          <div className={styles.warning}>
            <span className="material-symbols-outlined" aria-hidden="true">
              info
            </span>
            <span>
              {t.revenueWithoutCost(formatPrice(stats.revenueWithoutCost))} {t.fillCostHint}
            </span>
            <Link to="/admin/products" className={styles.warningLink}>
              {t.fill}
            </Link>
          </div>
        )}
      </Section>

      {/* Прочие расходы и прибыль после них */}
      <ExpensesSection from={stats.from} to={stats.to} profit={stats.profit} />

      {/* Лучшие товары */}
      <Section title={t.topProducts}>
        {stats.topProducts.length > 0 ? (
          <div className={styles.topProducts}>
            <div className={styles.tableHeader}>
              <div>{t.product}</div>
              <div className={styles.productQuantity}>{t.sold}</div>
              <div className={styles.productRevenue}>{t.revenue}</div>
              <div className={styles.productProfit}>{t.profit}</div>
            </div>
            {stats.topProducts.map((product) => (
              <div key={product.productId || product.name} className={styles.productRow}>
                <div className={styles.productName}>{product.name}</div>
                <div className={styles.productQuantity}>{product.quantity}</div>
                <div className={styles.productRevenue}>{formatPrice(product.revenue)}</div>
                <div className={styles.productProfit}>
                  {product.profit !== null ? formatPrice(product.profit) : '—'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="analytics"
            title={t.emptyTitle}
            text={t.emptyText}
          />
        )}
      </Section>

      {/* Склад */}
      <Section title={t.inventory}>
        <div className={styles.inventoryGrid}>
          <div className={styles.inventoryRow}>
            <span>{t.totalUnits}</span>
            <strong>{stats.inventory.units}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>{t.byCost}</span>
            <strong>{formatPrice(stats.inventory.costValue)}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>{t.byPrice}</span>
            <strong>{formatPrice(stats.inventory.retailValue)}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>{t.potentialProfit}</span>
            <strong>{formatPrice(stats.inventory.retailValue - stats.inventory.costValue)}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>{t.lowStock(shop.lowStockThreshold)}</span>
            <strong>{stats.inventory.lowStock}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>{t.outOfStock}</span>
            <strong>{stats.inventory.outOfStock}</strong>
          </div>
          {stats.inventory.missingCost > 0 && (
            <div className={styles.inventoryRow}>
              <span>{t.withoutCost}</span>
              <Link to="/admin/products" className={styles.inventoryLink}>
                {t.fillCount(stats.inventory.missingCost)}
              </Link>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}