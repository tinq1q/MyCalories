import Glass from '../ui/Glass'

// Stand-in for screens built in later tasks.
export default function Placeholder({ title }: { title: string }) {
  return (
    <Glass as="section" className="placeholder">
      <h1>{title}</h1>
    </Glass>
  )
}
