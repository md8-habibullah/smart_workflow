import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Copy, RefreshCw } from 'lucide-react'
import { adminApi } from '../../lib/endpoints'
import { Button, Field, FormError, Input, Modal } from '../../components/ui'

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/** Lets an admin set a new password for another user. `user` = { id, full_name, email } or null. */
export default function ResetPasswordModal({ user, onClose }) {
  if (!user) return null
  return <ResetForm user={user} onClose={onClose} />
}

function ResetForm({ user, onClose }) {
  const [password, setPassword] = useState(generatePassword)
  const mutation = useMutation({
    mutationFn: () => adminApi.resetPassword(user.id, password),
    onSuccess: (res) => {
      toast.success(res.message, { duration: 6000 })
      onClose()
    },
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      toast.success('Password copied')
    } catch {
      toast.error('Copy not available')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Reset password"
      description={`${user.full_name || user.email} · ${user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={mutation.isPending} disabled={password.length < 6} onClick={() => mutation.mutate()}>
            Reset password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={mutation.error} />
        <Field label="New password" hint="At least 6 characters. Share it securely; the user is told to change it.">
          {(id) => (
            <div className="flex gap-2">
              <Input id={id} value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" autoComplete="off" />
              <Button variant="secondary" icon={RefreshCw} onClick={() => setPassword(generatePassword())} aria-label="Generate password" />
              <Button variant="secondary" icon={Copy} onClick={copy} aria-label="Copy password" />
            </div>
          )}
        </Field>
      </div>
    </Modal>
  )
}
