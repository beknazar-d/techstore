import { Fragment, type ReactNode } from 'react'
import { useLang } from '.'

/** Перерисовывает приложение целиком при смене языка (сбрасываются только незаполненные формы). */
export function LanguageRoot({ children }: { children: ReactNode }) {
  const lang = useLang()
  return <Fragment key={lang}>{children}</Fragment>
}
