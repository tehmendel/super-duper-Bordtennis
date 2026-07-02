export function FormPills({ results }: { results: ('W' | 'L')[] }) {
  if (results.length === 0) return <span className="text-slate-400 text-sm">Ingen kamper ennå</span>
  return (
    <div className="flex gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${
            r === 'W' ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}
