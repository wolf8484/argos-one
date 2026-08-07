import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  return (
    <div className="px-4 pt-10 pb-4 space-y-8">
      <div>
        <h1 className="text-display-md">Settings</h1>
        <p className="text-body-sm text-muted-foreground mt-1">Shop & account configuration</p>
      </div>

      <div className="border divide-y" style={{ borderColor: 'var(--hairline-strong)' }}>
        {[
          { label: 'Shop Name', value: 'My Shop' },
          { label: 'Mechanic Name', value: 'Not set' },
          { label: 'Database', value: <Badge variant="warning">Coming in v2</Badge> },
          { label: 'VIN Decoder', value: <Badge variant="success">NHTSA · Active</Badge> },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--hairline)' }}>
            <span className="text-body-sm text-muted-foreground">{label}</span>
            <span className="text-body-sm font-semibold">{value}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-caption text-muted-foreground pt-4">
        Argos One · v0.1.0
      </div>
    </div>
  )
}
