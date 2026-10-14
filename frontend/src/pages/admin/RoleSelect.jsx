import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApi } from '../../lib/endpoints'
import { ROLE_META } from '../../lib/format'
import { Select, useConfirm } from '../../components/ui'

const ROLE_HELP = {
  SUPER_ADMIN: 'full control, including other admins and roles',
  ADMIN: 'manages tasks, people and reports; is no longer offered for task allocation',
  EMPLOYEE: 'works on their own assigned tasks only',
}

/** Inline role changer with confirmation. Only rendered for super admins (the API enforces it too). */
export default function RoleSelect({ user, className }) {
  const queryClient = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const mutation = useMutation({
    mutationFn: (role) => adminApi.changeRole(user.id, role),
    onSuccess: (res) => {
      toast.success(res.message, { duration: 6000 })
      ;['users', 'employees', 'employee', 'dashboard', 'recommendations'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }))
    },
    onError: (e) => toast.error(e.message),
  })

  const onChange = async (role) => {
    const ok = await confirm({
      title: `Make ${user.full_name || user.email} ${ROLE_META[role].label}?`,
      message: `${ROLE_META[role].label}: ${ROLE_HELP[role]}. The change applies immediately and the user is notified.`,
      confirmLabel: `Change to ${ROLE_META[role].label}`,
    })
    if (ok) mutation.mutate(role)
  }

  return (
    <>
      {confirmDialog}
      <Select
        value={user.role}
        onChange={(e) => onChange(e.target.value)}
        disabled={mutation.isPending}
        className={className}
        aria-label={`Role of ${user.full_name || user.email}`}
      >
        {Object.entries(ROLE_META).map(([value, meta]) => (
          <option key={value} value={value}>
            {meta.label}
          </option>
        ))}
      </Select>
    </>
  )
}
