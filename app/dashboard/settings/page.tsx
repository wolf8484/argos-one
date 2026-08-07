import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  return (
    <div className="px-5 pt-10 pb-4 space-y-8">
      <div>
        <h1 className="text-display-sm">Settings</h1>
        <p className="text-body-sm mt-1">Shop & account configuration</p>
      </div>

      <div className="bg-card border border-[var(--hairline)] rounded-lg divide-y divide-[var(--hairline)]">
        {[
          { label: 'Shop Name', value: 'My Shop' },
          { label: 'Mechanic Name', value: 'Not set' },
          { label: 'Database', value: <Badge variant="warning">Coming in v2</Badge> },
          { label: 'VIN Decoder', value: <Badge variant="success">NHTSA · Active</Badge> },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3.5">
            <span className="text-body-sm">{label}</span>
            <span className="text-body-sm font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-caption pt-4">
        Argos One · v0.1.0
      </div>
    </div>
  )
}
