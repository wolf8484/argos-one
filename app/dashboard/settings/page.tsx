import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  return (
    <div className="px-4 pt-10 pb-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Shop & account configuration</p>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {[
          { label: 'Shop Name', value: 'My Shop' },
          { label: 'Mechanic Name', value: 'Not set' },
          { label: 'Database', value: <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10 text-xs">Coming in v2</Badge> },
          { label: 'VIN Decoder', value: <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-xs">NHTSA · Active</Badge> },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-muted-foreground pt-4">
        Argos One · v0.1.0
      </div>
    </div>
  )
}
