const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

// Russian thousands separator: 1320 -> "1 320" (narrow no-break space).
export const fmt = (n: number) => nf.format(n)
