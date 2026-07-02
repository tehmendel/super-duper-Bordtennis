import { QRCodeSVG } from 'qrcode.react'

export function QrCodePage() {
  const url = window.location.origin + import.meta.env.BASE_URL

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-bold">Skann for å åpne appen</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm">
        Heng denne opp ved bordtennisbordet, så kan alle raskt registrere en kamp rett fra mobilen.
      </p>
      <div className="card p-8 bg-white">
        <QRCodeSVG value={url} size={220} />
      </div>
      <p className="text-sm text-slate-400 font-mono">{url}</p>
    </div>
  )
}
