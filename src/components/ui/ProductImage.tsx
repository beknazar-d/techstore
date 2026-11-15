import { useState } from 'react'
import { cn } from '../../utils/cn'
import styles from './ProductImage.module.css'

interface ProductImageProps {
  src?: string | null
  alt: string
  className?: string
}

export function ProductImage({ src, alt, className }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && failedSrc !== src) {
    return (
      <div className={cn(styles.root, className)}>
        <img
          key={src}
          className={styles.img}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      </div>
    )
  }

  return (
    <div className={cn(styles.root, className)} role="img" aria-label={alt}>
      <span className={cn('material-symbols-outlined', styles.placeholder)} aria-hidden="true">
        image
      </span>
    </div>
  )
}
