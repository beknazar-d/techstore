import type { UiMessages } from '../ru/ui'

export const ui: UiMessages = {
  photosLimit: (max: number) => `${max} сүрөттөн ашык кошууга болбойт`,
  photoFailed: 'Сүрөттү иштетүү мүмкүн болгон жок',
  photoAlt: (index: number) => `${index}-сүрөт`,
  photoMain: 'Негизги',
  photoRemove: (index: number) => `${index}-сүрөттү өчүрүү`,
  photoLeft: (index: number) => `${index}-сүрөттү солго жылдыруу`,
  photoRight: (index: number) => `${index}-сүрөттү оңго жылдыруу`,
  compressing: 'Кысып жатабыз…',
  add: 'Кошуу',
  themeLight: 'Жарык теманы күйгүзүү',
  themeDark: 'Караңгы теманы күйгүзүү',
  imageReadFailed: 'Сүрөттү окуу мүмкүн болгон жок',
  imageUnsupported: 'Браузер сүрөттөрдү иштете албайт',
  imageOnly: 'Сүрөттөрдү гана жүктөөгө болот',
}
