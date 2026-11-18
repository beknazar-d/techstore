// Сжатие фото в браузере перед сохранением: canvas, без библиотек.
// Длинная сторона не больше 1600px, WebP ~0.8, а если браузер WebP не умеет — JPEG.

import { msg } from '../i18n'

export interface CompressImageOptions {
  /** Максимальная длинная сторона, px. По умолчанию 1600. */
  maxSide?: number
  /** Качество 0..1. По умолчанию 0.8. */
  quality?: number
}

type Source = ImageBitmap | HTMLImageElement

function loadViaImgTag(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(msg().ui.imageReadFailed))
    }
    img.src = url
  })
}

async function loadSource(file: File): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Учитывает поворот из EXIF (фото с телефона).
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Старый браузер или неподдерживаемый формат — пробуем через <img>.
    }
  }
  // Современные браузеры применяют EXIF-поворот к <img> сами.
  return loadViaImgTag(file)
}

function draw(source: Source, width: number, height: number, background?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(msg().ui.imageUnsupported)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

/**
 * Сжимает фото и возвращает data URL (`data:image/webp;base64,...` либо JPEG).
 * Бросает `Error` с русским текстом, если файл не картинка или его не удалось прочитать.
 */
export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<string> {
  const { maxSide = 1600, quality = 0.8 } = options
  if (!file.type.startsWith('image/')) {
    throw new Error(msg().ui.imageOnly)
  }

  const source = await loadSource(file)
  try {
    const srcWidth = source.width
    const srcHeight = source.height
    if (!srcWidth || !srcHeight) throw new Error(msg().ui.imageReadFailed)

    const scale = Math.min(1, maxSide / Math.max(srcWidth, srcHeight))
    const width = Math.max(1, Math.round(srcWidth * scale))
    const height = Math.max(1, Math.round(srcHeight * scale))

    const webp = draw(source, width, height).toDataURL('image/webp', quality)
    if (webp.startsWith('data:image/webp')) return webp

    // Браузер не умеет WebP и молча вернул PNG. JPEG не хранит прозрачность — кладём белый фон.
    return draw(source, width, height, 'white').toDataURL('image/jpeg', quality)
  } finally {
    if ('close' in source) source.close()
  }
}
