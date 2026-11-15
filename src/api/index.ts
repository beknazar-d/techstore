// Единственная точка входа в слой данных. Компоненты импортируют только отсюда:
//   import { listProducts, createOrder, getErrorMessage } from '../api'
// Сейчас данные лежат в localStorage (см. db.ts), позже реализация сменится на Supabase,
// а сигнатуры функций останутся прежними.

export { ApiError, getErrorMessage, type ApiErrorCode } from './errors'
export { subscribe, resetDemoData, type DbTable } from './db'
export { login, logout, getSession, onAuthChange } from './auth'
export { notify, type NotifyEvent } from './notify'
export {
  listCategories,
  getCategoryBySlug,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categories'
export {
  listProducts,
  getProductBySlug,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from './products'
export {
  createOrder,
  listOrders,
  getOrder,
  listOrderEvents,
  updateOrderStatus,
  cancelOrder,
  setOrderAdminNote,
  getAllowedOrderStatuses,
} from './orders'
export {
  createTradeIn,
  listTradeIns,
  getTradeIn,
  listTradeInEvents,
  evaluateTradeIn,
  updateTradeInStatus,
  setTradeInAdminNote,
  getAllowedTradeInStatuses,
  canEvaluateTradeIn,
} from './tradeIns'
