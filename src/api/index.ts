// Единственная точка входа в слой данных. Компоненты импортируют только отсюда:
//   import { listProducts, createOrder, getErrorMessage } from '../api'
// Данные — в Supabase (src/lib/supabase.ts): таблицы под RLS и функции базы (RPC).

export { ApiError, getErrorMessage, type ApiErrorCode } from './errors'
export { subscribe, type DbTable } from './client'
export { login, logout, getSession, onAuthChange } from './auth'
export { getShopStats } from './stats'
export { getShopInfo, updateShopInfo, DEFAULT_SHOP_INFO } from './shop'
export { subscribeAdminEvents } from './notifications'
export type { AdminEvent } from './notifications'
export { listExpenses, createExpense, deleteExpense } from './expenses'
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
  listActiveBanners,
  listBanners,
  createBanner,
  createBanners,
  updateBanner,
  deleteBanner,
  bannerText,
} from './banners'
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
  getBotSettings,
  updateBotSettings,
  connectBot,
  disconnectBot,
  sendTestNotification,
  listChats,
  getChat,
  listChatMessages,
  sendChatMessage,
  setChatMode,
  markChatRead,
} from './bot'
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
export {
  AI_PROVIDERS,
  AI_SECRET_PROVIDERS,
  AI_PROVIDER_NAMES,
  AI_KEY_PLACEHOLDERS,
  OPENAI_VOICES,
  ELEVENLABS_MODELS,
  EMPTY_CONVERSATION,
  isAssistantConversation,
  isAssistantReady,
  getAiSettings,
  updateAiSettings,
  connectAiKey,
  disconnectAiKey,
  listElevenLabsVoices,
  askAssistant,
  type AssistantConversation,
} from './ai'
