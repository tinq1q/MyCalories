import { THEME_LABELS, THEMES } from '../domain/types'
import { useDiary } from '../storage/DiaryContext'
import Glass from './Glass'

// «Тема» card in Profile: one round gradient preview per theme. Native radios
// give arrow-key navigation for free; the swatch gradients live in theme.css.
export default function ThemePicker() {
  const { state, setTheme } = useDiary()
  return (
    <Glass as="section" className="card-stack">
      <h2 id="theme-picker-title">Тема</h2>
      <div className="theme-picker" role="radiogroup" aria-labelledby="theme-picker-title">
        {THEMES.map((t) => (
          <label key={t} className="theme-option">
            <input type="radio" name="theme" value={t} checked={state.theme === t} onChange={() => setTheme(t)} />
            <span className={`theme-swatch swatch-${t}`} aria-hidden="true" />
            <span>{THEME_LABELS[t]}</span>
          </label>
        ))}
      </div>
    </Glass>
  )
}
