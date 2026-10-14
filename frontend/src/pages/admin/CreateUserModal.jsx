import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { adminApi, departmentsApi } from '../../lib/endpoints'
import { Button, Field, FormError, Input, Modal, Select } from '../../components/ui'

const EMPTY = { fullName: '', email: '', password: '', role: 'EMPLOYEE', jobPosition: '', departmentId: '', phoneNumber: '', dailyCapacityHours: '8' }

/** Admin-created accounts are approved immediately. Only super admins may create admins. */
export default function CreateUserModal({ open, onClose }) {
  if (!open) return null
  return <CreateUserForm onClose={onClose} />
}

function CreateUserForm({ onClose }) {
  const { isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createUser({
        ...form,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        dailyCapacityHours: Number(form.dailyCapacityHours) || 8,
        phoneNumber: form.phoneNumber || null,
        category: departments.data?.find((d) => String(d.id) === form.departmentId)?.name,
      }),
    onSuccess: (res) => {
      toast.success(`${form.fullName} added as ${res.data.employeeCode}`)
      ;['employees', 'users', 'dashboard', 'departments'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
      onClose()
    },
  })

  const valid = form.fullName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(form.email) && form.password.length >= 6 && form.jobPosition.trim().length >= 2

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Add a team member"
      description="The account is approved immediately and can sign in right away."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" loading={mutation.isPending} disabled={!valid}>
            Create account
          </Button>
        </>
      }
    >
      <form
        id="create-user"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) mutation.mutate()
        }}
      >
        <FormError error={mutation.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            {(id) => <Input id={id} value={form.fullName} onChange={set('fullName')} />}
          </Field>
          <Field label="Email" required>
            {(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}
          </Field>
          <Field label="Temporary password" required hint="At least 6 characters">
            {(id) => <Input id={id} type="text" value={form.password} onChange={set('password')} autoComplete="off" />}
          </Field>
          <Field label="Role">
            {(id) => (
              <Select id={id} value={form.role} onChange={set('role')}>
                <option value="EMPLOYEE">Employee</option>
                {isSuperAdmin && <option value="ADMIN">Admin</option>}
                {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
              </Select>
            )}
          </Field>
          <Field label="Job position" required>
            {(id) => <Input id={id} value={form.jobPosition} onChange={set('jobPosition')} />}
          </Field>
          <Field label="Department">
            {(id) => (
              <Select id={id} value={form.departmentId} onChange={set('departmentId')}>
                <option value="">None</option>
                {departments.data
                  ?.filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Phone">
            {(id) => <Input id={id} value={form.phoneNumber} onChange={set('phoneNumber')} />}
          </Field>
          <Field label="Daily capacity (hours)" hint="Used for workload calculations">
            {(id) => <Input id={id} type="number" min="1" max="24" step="0.5" value={form.dailyCapacityHours} onChange={set('dailyCapacityHours')} />}
          </Field>
        </div>
      </form>
    </Modal>
  )
}
