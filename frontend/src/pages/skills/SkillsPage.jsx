import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ListTodo, Pencil, Plus, Award, Trash2, Users } from 'lucide-react'
import { skillsApi } from '../../lib/endpoints'
import { Button, Card, EmptyState, Field, FormError, IconButton, Input, Modal, PageHeader, QueryView, SearchInput, Textarea, useConfirm } from '../../components/ui'

export default function SkillsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [confirm, confirmDialog] = useConfirm()
  const query = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list })

  const invalidate = () => ['skills', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
  const remove = useMutation({
    mutationFn: (s) => skillsApi.remove(s.id),
    onSuccess: () => {
      toast.success('Skill deleted')
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase()
    const groups = {}
    for (const s of query.data || []) {
      if (term && !`${s.name} ${s.category}`.toLowerCase().includes(term)) continue
      ;(groups[s.category] ||= []).push(s)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [query.data, search])

  const onDelete = async (s) => {
    const ok = await confirm({
      title: `Delete "${s.name}"?`,
      message: s.employee_count ? `It will also be removed from ${s.employee_count} employee profile(s).` : 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (ok) remove.mutate(s)
  }

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Skills catalogue"
        description="Skills that employees hold and tasks require."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            New skill
          </Button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search skills…" className="mb-5 max-w-sm" />
      <QueryView query={query}>
        {() =>
          grouped.length === 0 ? (
            <Card>
              <EmptyState icon={Award} title="No skills found" />
            </Card>
          ) : (
            <div className="space-y-6">
              {grouped.map(([category, skills]) => (
                <div key={category}>
                  <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    {category} · {skills.length}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {skills.map((s) => (
                      <Card key={s.id} className="group p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{s.name}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{s.description || 'No description.'}</p>
                          </div>
                          <div className="flex shrink-0 opacity-60 transition group-hover:opacity-100">
                            <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(s)} />
                            <IconButton
                              icon={Trash2}
                              label={s.task_count ? 'Used by tasks, cannot delete' : 'Delete'}
                              variant="danger"
                              disabled={s.task_count > 0}
                              onClick={() => onDelete(s)}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" /> {s.employee_count} people
                          </span>
                          <span className="flex items-center gap-1">
                            <ListTodo className="size-3.5" /> {s.task_count} tasks
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </QueryView>
      <SkillModal skill={editing} categories={[...new Set((query.data || []).map((s) => s.category))]} onClose={() => setEditing(null)} onSaved={invalidate} />
    </div>
  )
}

function SkillModal({ skill, categories, onClose, onSaved }) {
  if (!skill) return null
  return <SkillForm skill={skill} categories={categories} onClose={onClose} onSaved={onSaved} />
}

function SkillForm({ skill, categories, onClose, onSaved }) {
  const isEdit = Boolean(skill.id)
  const [form, setForm] = useState({ name: skill.name || '', category: skill.category || '', description: skill.description || '' })
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), category: form.category.trim() || 'General', description: form.description.trim() || null }
      return isEdit ? skillsApi.update(skill.id, payload) : skillsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Skill updated' : 'Skill created')
      onSaved()
      onClose()
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit skill' : 'New skill'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="skill-form" loading={mutation.isPending} disabled={!form.name.trim()}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id="skill-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <FormError error={mutation.error} />
        <Field label="Name" required>
          {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="Category" hint="Pick an existing category or type a new one">
          {(id) => (
            <>
              <Input id={id} list="skill-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Development" />
              <datalist id="skill-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Description">
          {(id) => <Textarea id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  )
}
