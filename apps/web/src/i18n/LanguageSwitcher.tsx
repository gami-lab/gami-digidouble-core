import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages, type SupportedLanguage } from './index'

export function LanguageSwitcher(): JSX.Element {
  const { t, i18n } = useTranslation()
  const currentLanguage = i18n.resolvedLanguage as SupportedLanguage

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    void i18n.changeLanguage(event.target.value)
  }

  return (
    <label className="language-switcher">
      <span className="sr-only">{t('language.label')}</span>
      <select value={currentLanguage} onChange={handleChange}>
        {supportedLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {t(`language.${lang}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
