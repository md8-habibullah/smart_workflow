import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BellRing,
  CheckCircle2,
  Eye,
  FileText,
  Inbox,
  KeyRound,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { settingsApi } from '../../lib/endpoints'
import { formatDateTime, timeAgo } from '../../lib/format'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FormError,
  IconButton,
  Input,
  Modal,
  PageHeader,
  QueryView,
  SearchInput,
  Select,
  Skeleton,
  Tabs,
  Toggle,
  cn,
  useConfirm,
} from '../../components/ui'
import { useDebounced } from '../../lib/useDebounced'

/** One-click presets for common providers (the admin still enters the username/password). */
const PRESETS = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false, note: 'Use a Google "App password" (2-step verification required).' },
  { name: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, secure: false, note: 'Use your Microsoft account e-mail and password.' },
  { name: 'Mailtrap (testing)', host: 'sandbox.smtp.mailtrap.io', port: 2525, secure: false, note: 'Catches every e-mail in a test inbox: great for demos.' },
  { name: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: false, note: 'Use the SMTP key from Brevo → SMTP & API.' },
]

const SECURITY = [
  { value: 'starttls', label: 'STARTTLS (port 587)', secure: false },
  { value: 'tls', label: 'SSL/TLS (port 465)', secure: true },
]

const STATUS_TONE = { SENT: 'green', PENDING: 'amber', FAILED: 'red' }

const toForm = (s) => ({
  enabled: s.enabled,
  transport: s.transport,
  smtpHost: s.smtpHost || '',
  smtpPort: s.smtpPort,
  smtpSecure: s.smtpSecure,
  smtpUser: s.smtpUser || '',
  smtpPassword: '',
  clearPassword: false,
  fromName: s.fromName,
  fromEmail: s.fromEmail,
  replyTo: s.replyTo || '',
  appUrl: s.appUrl,
  disabledEvents: s.disabledEvents,
})

export default function EmailSettingsPage() {
  const settings = useQuery({ queryKey: ['email-settings'], queryFn: settingsApi.email })

  return (
    <div>
      <PageHeader
        title="E-mail settings"
        description="One global configuration used for every e-mail the system sends. Only super admins can see this page."
      />
      <QueryView query={settings} loader={<Skeleton className="h-[520px]" />}>
        {(data) => (
          <>
            {/* Re-mount the form whenever the saved settings change, so it starts from the server state. */}
            <SettingsForm key={data.settings.updatedAt} data={data} />
            <Outbox counts={data.outbox} />
          </>
        )}
      </QueryView>
    </div>
  )
}

function StatusStrip({ settings, counts }) {
  const items = [
    {
      label: 'Delivery',
      value: settings.enabled ? 'Enabled' : 'Disabled',
      tone: settings.enabled ? 'text-brand-700' : 'text-slate-500',
      icon: settings.enabled ? CheckCircle2 : TriangleAlert,
    },
    { label: 'Transport', value: settings.transport === 'LOG' ? 'Log only (demo)' : settings.smtpHost, tone: 'text-slate-900', icon: Server },
    { label: 'Delivered', value: counts.SENT, tone: 'text-slate-900', icon: Send },
    { label: 'Failed', value: counts.FAILED, tone: counts.FAILED ? 'text-red-600' : 'text-slate-900', icon: TriangleAlert },
  ]
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="flex items-center gap-3 p-4">
          <item.icon className={cn('size-5 shrink-0', item.tone)} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className={cn('truncate text-sm font-semibold', item.tone)}>{item.value}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}

function SettingsForm({ data }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const saved = data.settings
  const initial = useMemo(() => toForm(saved), [saved])
  const [form, setForm] = useState(initial)
  const [testTo, setTestTo] = useState(user?.email || '')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const smtp = form.transport === 'SMTP'

  const save = useMutation({
    mutationFn: () => settingsApi.saveEmail(form),
    onSuccess: (res) => {
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
      queryClient.invalidateQueries({ queryKey: ['email-outbox'] })
    },
  })

  const test = useMutation({
    // Tests what is on screen, saved or not.
    mutationFn: () => settingsApi.testEmail(testTo.trim(), form),
    onSuccess: (res) => toast.success(res.message, { duration: 6000 }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['email-outbox'] })
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
    },
  })

  const groups = useMemo(() => {
    const map = new Map()
    data.events.forEach((e) => map.set(e.group, [...(map.get(e.group) || []), e]))
    return [...map.entries()]
  }, [data.events])

  const toggleEvent = (type, on) =>
    set({ disabledEvents: on ? form.disabledEvents.filter((t) => t !== type) : [...form.disabledEvents, type] })

  return (
    <>
      <StatusStrip settings={saved} counts={data.outbox} />

      {!saved.passwordReadable && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          The stored SMTP password can no longer be decrypted (the server secret changed). Enter the password again and save.
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
        className="grid gap-6 xl:grid-cols-3"
      >
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader icon={Server} title="Delivery" description="Where e-mails go. Log only keeps everything on this server, so it's ideal for demos." />
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <Toggle
                  checked={form.enabled}
                  onChange={(enabled) => set({ enabled })}
                  label="Send e-mails"
                  description="When off, notifications stay in-app only and forgot-password is unavailable."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Transport">
                {[
                  { value: 'LOG', title: 'Log only', text: 'Nothing leaves the server. Messages appear in the outbox below with a preview.', icon: FileText },
                  { value: 'SMTP', title: 'SMTP server', text: 'Real delivery through Gmail, Outlook, Mailtrap or any SMTP provider.', icon: Send },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={form.transport === opt.value}
                    onClick={() => set({ transport: opt.value })}
                    className={cn(
                      'flex gap-3 rounded-xl border p-4 text-left transition',
                      form.transport === opt.value ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <opt.icon className={cn('mt-0.5 size-5 shrink-0', form.transport === opt.value ? 'text-brand-600' : 'text-slate-400')} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{opt.text}</span>
                    </span>
                  </button>
                ))}
              </div>

              {smtp && (
                <div className="animate-fade-in space-y-4 border-t border-slate-100 pt-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Quick presets</p>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          title={p.note}
                          onClick={() => {
                            set({ smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure })
                            toast(p.note, { icon: '💡' })
                          }}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-semibold transition',
                            form.smtpHost === p.host ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300',
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                    <Field label="SMTP host" required>
                      {(id) => <Input id={id} value={form.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" />}
                    </Field>
                    <Field label="Port" required>
                      {(id) => <Input id={id} type="number" min={1} max={65535} value={form.smtpPort} onChange={(e) => set({ smtpPort: e.target.value })} />}
                    </Field>
                  </div>
                  <Field label="Security">
                    {(id) => (
                      <Select
                        id={id}
                        value={form.smtpSecure ? 'tls' : 'starttls'}
                        onChange={(e) => {
                          const opt = SECURITY.find((o) => o.value === e.target.value)
                          set({ smtpSecure: opt.secure, smtpPort: opt.secure ? 465 : Number(form.smtpPort) === 465 ? 587 : form.smtpPort })
                        }}
                      >
                        {SECURITY.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Username" hint="Usually the full e-mail address">
                      {(id) => <Input id={id} autoComplete="off" value={form.smtpUser} onChange={(e) => set({ smtpUser: e.target.value })} />}
                    </Field>
                    <Field
                      label="Password / app password"
                      hint={
                        saved.hasPassword && !form.clearPassword ? (
                          <span>
                            A password is saved (encrypted). Leave blank to keep it ·{' '}
                            <button type="button" className="font-semibold text-red-600 hover:underline" onClick={() => set({ clearPassword: true, smtpPassword: '' })}>
                              remove
                            </button>
                          </span>
                        ) : form.clearPassword ? (
                          <span className="text-red-600">The saved password will be removed on save.</span>
                        ) : (
                          'Stored encrypted (AES-256-GCM), never shown again'
                        )
                      }
                    >
                      {(id) => (
                        <div className="relative">
                          <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            id={id}
                            type="password"
                            autoComplete="new-password"
                            className="pl-9"
                            placeholder={saved.hasPassword && !form.clearPassword ? '••••••••  (saved)' : ''}
                            value={form.smtpPassword}
                            onChange={(e) => set({ smtpPassword: e.target.value, clearPassword: false })}
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={Mail} title="Sender" description="How messages appear in the recipient's inbox, and where links point." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From name" required>
                {(id) => <Input id={id} value={form.fromName} onChange={(e) => set({ fromName: e.target.value })} />}
              </Field>
              <Field label="From address" required hint={smtp ? 'Most providers require this to match the SMTP account' : undefined}>
                {(id) => <Input id={id} type="email" value={form.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} />}
              </Field>
              <Field label="Reply-to" hint="Optional">
                {(id) => <Input id={id} type="email" value={form.replyTo} onChange={(e) => set({ replyTo: e.target.value })} placeholder="it-support@university.edu" />}
              </Field>
              <Field label="App URL" required hint="Used for buttons and password-reset links">
                {(id) => <Input id={id} value={form.appUrl} onChange={(e) => set({ appUrl: e.target.value })} placeholder="http://localhost:5173" />}
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={BellRing}
              title="Which events send e-mail"
              description="Every event is always shown in-app; these switches only control the e-mail copy."
              action={
                <div className="flex gap-1">
                  <Button size="xs" variant="ghost" onClick={() => set({ disabledEvents: [] })}>
                    All on
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => set({ disabledEvents: data.events.filter((e) => !e.required).map((e) => e.type) })}>
                    All off
                  </Button>
                </div>
              }
            />
            <div className="grid gap-6 md:grid-cols-2">
              {groups.map(([group, events]) => (
                <div key={group}>
                  <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{group}</p>
                  <div className="space-y-3">
                    {events.map((e) => (
                      <div key={e.type} className={cn(e.required && 'opacity-70')}>
                        <Toggle
                          checked={e.required || !form.disabledEvents.includes(e.type)}
                          onChange={(on) => !e.required && toggleEvent(e.type, on)}
                          label={e.label}
                          description={e.required ? 'Always sent' : undefined}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-24">
            <CardHeader icon={ShieldCheck} title="Send a test" description="Uses the settings on screen, even before you save them." />
            <FormError error={test.error} />
            <div className={cn('space-y-3', test.error && 'mt-3')}>
              <Field label="Recipient">
                {(id) => <Input id={id} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />}
              </Field>
              <Button variant="secondary" icon={Send} className="w-full" loading={test.isPending} disabled={!testTo.includes('@')} onClick={() => test.mutate()}>
                Send test e-mail
              </Button>
              {test.isSuccess && (
                <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {test.data.message}
                </p>
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <FormError error={save.error} />
              <div className={cn('flex flex-col gap-2', save.error && 'mt-3')}>
                <Button type="submit" icon={Save} loading={save.isPending} disabled={!dirty}>
                  Save settings
                </Button>
                <Button variant="ghost" icon={RotateCcw} disabled={!dirty} onClick={() => setForm(initial)}>
                  Discard changes
                </Button>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">
                {dirty ? 'You have unsaved changes.' : `Last saved ${timeAgo(saved.updatedAt)}.`}
              </p>
            </div>
          </Card>
        </div>
      </form>
    </>
  )
}

function Outbox({ counts }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(null)
  const [confirm, confirmDialog] = useConfirm()
  const debounced = useDebounced(search, 300)

  const outbox = useQuery({
    queryKey: ['email-outbox', status, debounced],
    queryFn: () => settingsApi.outbox({ status: status || undefined, search: debounced || undefined, limit: 100 }),
    refetchInterval: 10_000,
  })
  const message = useQuery({
    queryKey: ['email-message', preview],
    queryFn: () => settingsApi.outboxMessage(preview),
    enabled: Boolean(preview),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['email-outbox'] })
    queryClient.invalidateQueries({ queryKey: ['email-settings'] })
  }
  const flush = useMutation({ mutationFn: settingsApi.flush, onSuccess: (r) => (toast.success(r.message), refresh()), onError: (e) => toast.error(e.message) })
  const retry = useMutation({ mutationFn: settingsApi.retry, onSuccess: (r) => (toast.success(r.message), refresh()), onError: (e) => toast.error(e.message) })
  const clear = useMutation({ mutationFn: settingsApi.clearOutbox, onSuccess: (r) => (toast.success(r.message), refresh()), onError: (e) => toast.error(e.message) })

  const live = outbox.data?.counts || counts
  const tabs = [
    { value: '', label: 'All', count: live.PENDING + live.SENT + live.FAILED },
    { value: 'PENDING', label: 'Queued', count: live.PENDING },
    { value: 'SENT', label: 'Delivered', count: live.SENT },
    { value: 'FAILED', label: 'Failed', count: live.FAILED },
  ]

  return (
    <Card className="mt-6" padded={false}>
      {confirmDialog}
      <div className="p-5 pb-0">
        <CardHeader
          icon={Inbox}
          title="Outbox"
          description="Every e-mail is written here in the same database transaction as the change that caused it, then delivered by a background worker with retries."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={RefreshCw} loading={flush.isPending} onClick={() => flush.mutate()}>
                Process now
              </Button>
              <Button
                size="sm"
                variant="danger-ghost"
                icon={Trash2}
                onClick={async () => {
                  if (await confirm({ title: 'Clear the e-mail log?', message: 'Delivered and failed messages are deleted. Queued messages are kept.', tone: 'danger', confirmLabel: 'Clear log' })) {
                    clear.mutate(undefined)
                  }
                }}
              >
                Clear log
              </Button>
            </div>
          }
        />
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs tabs={tabs} value={status} onChange={setStatus} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search recipient or subject…" className="sm:w-72" />
        </div>
      </div>

      <div className="overflow-x-auto scroll-thin">
        {outbox.isPending ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !outbox.data?.items.length ? (
          <EmptyState icon={Inbox} title="No e-mails here yet" description="Enable e-mail, then trigger something: assign a task, comment, or send a test." className="py-12" />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Recipient</th>
                <th className="px-3 py-2.5">Subject</th>
                <th className="px-3 py-2.5">Event</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">When</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {outbox.data.items.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="max-w-[180px] truncate px-5 py-3 font-medium text-slate-900" title={m.to_email}>{m.to_email}</td>
                  <td className="max-w-[220px] truncate px-3 py-3 text-slate-700" title={m.subject}>{m.subject}</td>
                  <td className="px-3 py-3">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{m.event_type}</code>
                  </td>
                  <td className="px-3 py-3">
                    <span title={m.last_error || ''}>
                      <Badge tone={STATUS_TONE[m.status]} dot>
                        {m.status === 'PENDING' && m.attempts > 0 ? `Retrying (${m.attempts})` : m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                      </Badge>
                    </span>
                    {m.last_error && <p className="mt-1 max-w-[160px] truncate text-[11px] text-red-600" title={m.last_error}>{m.last_error}</p>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-500" title={`${formatDateTime(m.created_at)}${m.transport ? ` · via ${m.transport}` : ''}`}>
                    {timeAgo(m.sent_at || m.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton icon={Eye} label="Preview e-mail" onClick={() => setPreview(m.id)} className="size-7" />
                      {m.status === 'FAILED' && (
                        <Button size="xs" variant="secondary" icon={RotateCcw} loading={retry.isPending && retry.variables === m.id} onClick={() => retry.mutate(m.id)}>
                          Retry
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={message.data?.subject || 'E-mail preview'} description={message.data ? `To ${message.data.to_email}` : undefined} size="lg">
        {message.isPending ? (
          <Skeleton className="h-96" />
        ) : message.data ? (
          // sandbox: the HTML is rendered without scripts or same-origin access.
          <iframe title="E-mail preview" sandbox="" srcDoc={message.data.html_body} className="h-[60vh] w-full rounded-lg border border-slate-200 bg-white" />
        ) : null}
      </Modal>
    </Card>
  )
}
