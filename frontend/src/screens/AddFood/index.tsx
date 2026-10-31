import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isValidDayKey, todayKey } from '../../domain/dates'
import { defaultMeal } from '../../domain/nutrition'
import { MEALS } from '../../domain/types'
import type { Meal, Product } from '../../domain/types'
import { useDiary } from '../../storage/DiaryContext'
import { useToast } from '../../ui/Toast'
import AmountStep from './AmountStep'
import CustomProductForm from './CustomProductForm'
import SearchStep from './SearchStep'

type Step = { name: 'search' } | { name: 'custom' } | { name: 'amount'; product: Product }

export default function AddFood() {
  const { addEntry, removeEntry, addCustomProduct } = useDiary()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const rawDay = params.get('day')
  const day = isValidDayKey(rawDay) ? rawDay : todayKey()
  const rawMeal = params.get('meal')
  const [meal, setMeal] = useState<Meal>(() => MEALS.find((m) => m === rawMeal) ?? defaultMeal(new Date()))
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>({ name: 'search' })

  // Single entry point for choosing a product (search results now; photo recognition later).
  const onPickProduct = (product: Product) => setStep({ name: 'amount', product })

  const add = (product: Product, grams: number) => {
    const id = addEntry({ date: day, meal, product, grams })
    toast.show('Добавлено', { label: 'Отменить', onClick: () => removeEntry(id) })
    navigate(`/?day=${day}&new=${id}`, { replace: true })
  }

  if (step.name === 'amount') {
    return <AmountStep product={step.product} meal={meal} day={day} onBack={() => setStep({ name: 'search' })} onAdd={(g) => add(step.product, g)} />
  }
  if (step.name === 'custom') {
    return (
      <CustomProductForm
        initialName={query}
        onBack={() => setStep({ name: 'search' })}
        onSave={(draft) => onPickProduct(addCustomProduct(draft))}
      />
    )
  }
  return (
    <SearchStep
      day={day}
      meal={meal}
      query={query}
      onMeal={setMeal}
      onQuery={setQuery}
      onPick={onPickProduct}
      onCreate={() => setStep({ name: 'custom' })}
    />
  )
}
