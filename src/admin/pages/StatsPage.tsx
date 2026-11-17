import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getShopStats } from '../../api/stats'
import { formatPrice } from '../../utils/format'
import { PageHeader, Section } from '../components/AdminBlocks'
import { StatsChart } from '../components/StatsChart'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApiQuery } from '../../hooks/useApiQuery'
import styles from './StatsPage.module.css'

const PERIODS = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
] as const

type PeriodValue = typeof PERIODS[number]['value']

export function StatsPage() {
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
        title="Статистика"
        subtitle="Деньги — по выполненным заказам, дата — по дню заявки"
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
            {item.label}
          </button>
        ))}
      </div>

      {/* KPI-плитки */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Выручка</div>
          <div className={styles.kpiValue}>{formatPrice(stats.revenue)}</div>
          <div className={styles.kpiSub}>
            выполнено заказов: {stats.ordersCompleted}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Прибыль</div>
          <div className={styles.kpiValue}>{formatPrice(stats.profit)}</div>
          <div className={styles.kpiSub}>
            {stats.marginPercent !== null
              ? `наценка ${stats.marginPercent}%`
              : 'нет себестоимости'
            }
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Средний чек</div>
          <div className={styles.kpiValue}>
            {stats.averageCheck ? formatPrice(stats.averageCheck) : '—'}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Заявок</div>
          <div className={styles.kpiValue}>{stats.ordersTotal}</div>
          <div className={styles.kpiSub}>
            отменено {stats.ordersCancelled} ({stats.cancelRatePercent}%)
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>В работе</div>
          <div className={styles.kpiValue}>{stats.ordersInProgress}</div>
          <div className={styles.kpiSub}>
            на {formatPrice(stats.inProgressValue)}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Trade-in</div>
          <div className={styles.kpiValue}>{stats.tradeInsTotal}</div>
          <div className={styles.kpiSub}>
            согласились: {stats.tradeInsAccepted}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Сайт / Telegram</div>
          <div className={styles.kpiValue}>
            {stats.ordersBySource.site} / {stats.ordersBySource.telegram}
          </div>
          <div className={styles.kpiSub}>заявок по источникам</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>На складе</div>
          <div className={styles.kpiValue}>{formatPrice(stats.inventory.costValue)}</div>
          <div className={styles.kpiSub}>
            по себестоимости, {stats.inventory.units} шт.
          </div>
        </div>
      </div>

      {/* График */}
      <Section title="Выручка и прибыль по дням">
        <StatsChart days={stats.daily} />
        {stats.revenueWithoutCost > 0 && (
          <div className={styles.warning}>
            <span className="material-symbols-outlined" aria-hidden="true">
              info
            </span>
            <span>
              {formatPrice(stats.revenueWithoutCost)} выручки без себестоимости — не вошли в прибыль.
              Укажите себестоимость в карточках товаров.
            </span>
            <Link to="/admin/products" className={styles.warningLink}>
              Заполнить
            </Link>
          </div>
        )}
      </Section>

      {/* Лучшие товары */}
      <Section title="Лучшие товары">
        {stats.topProducts.length > 0 ? (
          <div className={styles.topProducts}>
            <div className={styles.tableHeader}>
              <div>Товар</div>
              <div className={styles.productQuantity}>Продано, шт.</div>
              <div className={styles.productRevenue}>Выручка</div>
              <div className={styles.productProfit}>Прибыль</div>
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
            title="За период нет выполненных заказов"
            text="Данные появятся после оформления заказов"
          />
        )}
      </Section>

      {/* Склад */}
      <Section title="Склад сейчас">
        <div className={styles.inventoryGrid}>
          <div className={styles.inventoryRow}>
            <span>Всего штук</span>
            <strong>{stats.inventory.units}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>По себестоимости</span>
            <strong>{formatPrice(stats.inventory.costValue)}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>По цене продажи</span>
            <strong>{formatPrice(stats.inventory.retailValue)}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>Возможная прибыль</span>
            <strong>{formatPrice(stats.inventory.retailValue - stats.inventory.costValue)}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>Заканчивается (≤ 3 шт.)</span>
            <strong>{stats.inventory.lowStock}</strong>
          </div>
          <div className={styles.inventoryRow}>
            <span>Нет в наличии</span>
            <strong>{stats.inventory.outOfStock}</strong>
          </div>
          {stats.inventory.missingCost > 0 && (
            <div className={styles.inventoryRow}>
              <span>Без себестоимости</span>
              <Link to="/admin/products" className={styles.inventoryLink}>
                Заполнить ({stats.inventory.missingCost})
              </Link>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}