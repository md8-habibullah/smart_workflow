import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { projectsApi, skillsApi, tasksApi } from '../lib/endpoints'
import { PRIORITIES, PRIORITY_META, PROFICIENCY_LEVELS, PROFICIENCY_META, fromDateTimeInput, toDateTimeInput } from '../lib/format'
import { Button, Field, FormError, IconButton, Input, Modal, Select, Textarea } from './ui'

const defaultDeadline = () => {
  const d = new Date(Date.now() + 7 * 86400000)
  d.setHours(17, 0, 0, 0)
  return toDateTimeInput(d)
}

const fromTask = (task) =>
  task
    ? {
        title: task.title,
        description: task.description || '',
        projectId: String(task.project_id),
        priority: task.priority,
        estimatedHours: String(task.estimated_hours),
        deadline: toDateTimeInput(task.deadline),
        requiredSkills: (task.requiredSkills || []).map((s) => ({ skillId: String(s.skill_id), minProficiencyLevel: s.min_proficiency_level })),
      }
    : {
        title: '',
        description: '',
        projectId: '',
        priority: 'MEDIUM',
        estimatedHours: '',
        deadline: defaultDeadline(),
        requiredSkills: [],
      }

/**
 * Create or edit a task. Pass `task` (with requiredSkills) to edit.
 * `defaultProjectId` pre-selects a project when creating from a project page.
 */
export default function TaskFormModal({ open, onClose, task, defaultProjectId, onSaved }) {
  // Remount the form whenever it opens so state is fresh.
  if (!open) return null
  return <TaskForm onClose={onClose} task={task} defaultProjectId={defaultProjectId} onSaved={onSaved} />
}

function TaskForm({ onClose, task, defaultProjectId, onSaved }) {
  const queryClient = useQueryClient()
  const isEdit = Boolean(task)
  const [form, setForm] = useState(() => {
    const initial = fromTask(task)
    if (!isEdit && defaultProjectId) initial.projectId = String(defaultProjectId)
    return initial
  })
  const [touched, setTouched] = useState(false)

  const projects = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() })
  const skills = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list })

  const errors = {}
  if (touched) {
    if (form.title.trim().length < 2) errors.title = 'Title is required'
    if (!form.projectId) errors.projectId = 'Choose a project'
    if (!(Number(form.estimatedHours) > 0)) errors.estimatedHours = 'Must be greater than 0'
    if (!form.deadline) errors.deadline = 'Deadline is required'
    else if (new Date(form.deadline).getTime() <= Date.now()) errors.deadline = 'Deadline must be in the future'
  }

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? tasksApi.update(task.id, payload) : tasksApi.create(payload)),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Task updated' : 'Task created')
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onSaved?.(res.data)
      onClose()
    },
  })

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const setSkill = (index, key, value) =>
    setForm({ ...form, requiredSkills: form.requiredSkills.map((s, i) => (i === index ? { ...s, [key]: value } : s)) })
  const usedSkillIds = new Set(form.requiredSkills.map((s) => s.skillId))

  const submit = (e) => {
    e.preventDefault()
    setTouched(true)
    const hasErrors =
      form.title.trim().length < 2 ||
      !form.projectId ||
      !(Number(form.estimatedHours) > 0) ||
      !form.deadline ||
      new Date(form.deadline).getTime() <= Date.now()
    if (hasErrors) return
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      projectId: Number(form.projectId),
      priority: form.priority,
      estimatedHours: Number(form.estimatedHours),
      requiredSkills: form.requiredSkills
        .filter((s) => s.skillId)
        .map((s) => ({ skillId: Number(s.skillId), minProficiencyLevel: s.minProficiencyLevel })),
    }
    // Only send the deadline on edit when it actually changed (backend requires future deadlines).
    if (!isEdit || form.deadline !== toDateTimeInput(task.deadline)) payload.deadline = fromDateTimeInput(form.deadline)
    mutation.mutate(payload)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit task' : 'Create a new task'}
      description={isEdit ? 'Update details and skill requirements.' : 'Required skills drive the smart allocation engine.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError error={mutation.error} />
        <Field label="Title" required error={errors.title}>
          {(id) => <Input id={id} value={form.title} onChange={set('title')} placeholder="e.g. Build login API" error={errors.title} />}
        </Field>
        <Field label="Description">
          {(id) => <Textarea id={id} value={form.description} onChange={set('description')} placeholder="What needs to be done?" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" required error={errors.projectId}>
            {(id) => (
              <Select id={id} value={form.projectId} onChange={set('projectId')} error={errors.projectId}>
                <option value="">Select project…</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Estimated hours" required error={errors.estimatedHours}>
            {(id) => (
              <Input id={id} type="number" min="0.5" step="0.5" value={form.estimatedHours} onChange={set('estimatedHours')} error={errors.estimatedHours} />
            )}
          </Field>
          <Field label="Deadline" required error={errors.deadline}>
            {(id) => <Input id={id} type="datetime-local" value={form.deadline} onChange={set('deadline')} error={errors.deadline} />}
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Required skills</p>
              <p className="text-xs text-slate-500">Only employees meeting every minimum level are eligible.</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setForm({ ...form, requiredSkills: [...form.requiredSkills, { skillId: '', minProficiencyLevel: 'INTERMEDIATE' }] })}
              disabled={skills.data && usedSkillIds.size >= skills.data.length}
            >
              Add skill
            </Button>
          </div>
          {form.requiredSkills.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 italic">No skill requirements: every active employee is eligible.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {form.requiredSkills.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={s.skillId} onChange={(e) => setSkill(i, 'skillId', e.target.value)} className="flex-1" aria-label="Skill">
                    <option value="">Select skill…</option>
                    {skills.data?.map((sk) => (
                      <option key={sk.id} value={sk.id} disabled={usedSkillIds.has(String(sk.id)) && String(sk.id) !== s.skillId}>
                        {sk.name} ({sk.category})
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={s.minProficiencyLevel}
                    onChange={(e) => setSkill(i, 'minProficiencyLevel', e.target.value)}
                    className="w-40"
                    aria-label="Minimum level"
                  >
                    {PROFICIENCY_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        ≥ {PROFICIENCY_META[l].label}
                      </option>
                    ))}
                  </Select>
                  <IconButton
                    icon={Trash2}
                    label="Remove skill"
                    variant="danger"
                    onClick={() => setForm({ ...form, requiredSkills: form.requiredSkills.filter((_, idx) => idx !== i) })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
