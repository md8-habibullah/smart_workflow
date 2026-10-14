import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, FolderKanban, Pencil, Plus, Power, Trash2, Users } from 'lucide-react'
import { departmentsApi } from '../../lib/endpoints'
import { Badge, Button, Card, EmptyState, Field, FormError, IconButton, Input, Modal, PageHeader, QueryView, Textarea, useConfirm } from '../../components/ui'

export default function DepartmentsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null) // null | {} (new) | department
  const [confirm, confirmDialog] = useConfirm()
  const query = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list })

  const invalidate = () => ['departments', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))

  const toggle = useMutation({
    mutationFn: (d) => departmentsApi.update(d.id, { isActive: !d.is_active }),
    onSuccess: () => {
      toast.success('Department updated')
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (d) => departmentsApi.remove(d.id),
    onSuccess: () => {
      toast.success('Department deleted')
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const onDelete = async (d) => {
    if (await confirm({ title: `Delete ${d.name}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' })) remove.mutate(d)
  }

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Departments"
        description="Organisational units for employees and projects."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            New department
          </Button>
        }
      />
      <QueryView query={query}>
        {(departments) =>
          departments.length === 0 ? (
            <Card>
              <EmptyState icon={Building2} title="No departments yet" action={<Button icon={Plus} onClick={() => setEditing({})}>New department</Button>} />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {departments.map((d) => (
                <Card key={d.id} className={d.is_active ? '' : 'opacity-60'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Building2 className="size-5" />
                    </div>
                    <div className="flex gap-0.5">
                      <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(d)} />
                      <IconButton icon={Power} label={d.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggle.mutate(d)} />
                      <IconButton icon={Trash2} label="Delete" variant="danger" onClick={() => onDelete(d)} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{d.name}</h3>
                    {!d.is_active && <Badge tone="red">Inactive</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{d.description || 'No description.'}</p>
                  <div className="mt-4 flex gap-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-4 text-slate-400" /> {d.total_employees} employee{d.total_employees === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FolderKanban className="size-4 text-slate-400" /> {d.total_projects} project{d.total_projects === 1 ? '' : 's'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )
        }
      </QueryView>
      <DepartmentModal department={editing} onClose={() => setEditing(null)} onSaved={invalidate} />
    </div>
  )
}

function DepartmentModal({ department, onClose, onSaved }) {
  if (!department) return null
  return <DepartmentForm department={department} onClose={onClose} onSaved={onSaved} />
}

function DepartmentForm({ department, onClose, onSaved }) {
  const isEdit = Boolean(department.id)
  const [form, setForm] = useState({ name: department.name || '', description: department.description || '' })
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), description: form.description.trim() || null }
      return isEdit ? departmentsApi.update(department.id, payload) : departmentsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Department updated' : 'Department created')
      onSaved()
      onClose()
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit department' : 'New department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="dept-form" loading={mutation.isPending} disabled={form.name.trim().length < 2}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id="dept-form"
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
        <Field label="Description">
          {(id) => <Textarea id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  )
}
