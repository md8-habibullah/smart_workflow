import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { departmentsApi, projectsApi } from '../../lib/endpoints'
import { Button, Field, FormError, Input, Modal, Select, Textarea, Toggle } from '../../components/ui'

export default function ProjectFormModal({ project, onClose, onSaved }) {
  if (!project) return null
  return <ProjectForm project={project} onClose={onClose} onSaved={onSaved} />
}

function ProjectForm({ project, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const isEdit = Boolean(project.id)
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list })
  const [form, setForm] = useState({
    name: project.name || '',
    description: project.description || '',
    departmentId: project.department_id ? String(project.department_id) : '',
    startDate: project.start_date || '',
    endDate: project.end_date || '',
    requiresMembership: Boolean(project.requires_membership),
  })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const datesInvalid = form.startDate && form.endDate && form.startDate > form.endDate

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        requiresMembership: form.requiresMembership,
      }
      return isEdit ? projectsApi.update(project.id, payload) : projectsApi.create(payload)
    },
    onSuccess: (res) => {
      toast.success(isEdit ? 'Project updated' : 'Project created')
      ;['projects', 'project', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
      onSaved?.(res.data)
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit project' : 'New project'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" loading={mutation.isPending} disabled={form.name.trim().length < 2 || datesInvalid}>
            {isEdit ? 'Save' : 'Create project'}
          </Button>
        </>
      }
    >
      <form
        id="project-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <FormError error={mutation.error} />
        <Field label="Name" required>
          {(id) => <Input id={id} value={form.name} onChange={set('name')} />}
        </Field>
        <Field label="Description">
          {(id) => <Textarea id={id} value={form.description} onChange={set('description')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Department">
            {(id) => (
              <Select id={id} value={form.departmentId} onChange={set('departmentId')}>
                <option value="">None</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Start date">
            {(id) => <Input id={id} type="date" value={form.startDate} onChange={set('startDate')} />}
          </Field>
          <Field label="End date" error={datesInvalid ? 'Must be after the start date' : undefined}>
            {(id) => <Input id={id} type="date" value={form.endDate} onChange={set('endDate')} error={datesInvalid} />}
          </Field>
        </div>
        <Toggle
          checked={form.requiresMembership}
          onChange={(v) => setForm({ ...form, requiresMembership: v })}
          label="Members only"
          description="Only project members are eligible for this project's tasks."
        />
      </form>
    </Modal>
  )
}
