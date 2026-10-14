import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../lib/endpoints'
import { Avatar, Button, Spinner } from './ui'

const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/** Profile photo for the signed-in user: upload (PNG/JPG/GIF/WebP ≤ 2 MB), replace or remove. */
export default function AvatarUploader() {
  const { user, displayName, refreshUser } = useAuth()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file) => {
    if (!file) return
    if (!TYPES.includes(file.type)) return toast.error('Choose a PNG, JPG, GIF or WebP image.')
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be 2 MB or smaller.')
    setBusy(true)
    try {
      await authApi.uploadAvatar(file)
      await refreshUser()
      toast.success('Profile photo updated')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await authApi.deleteAvatar()
      await refreshUser()
      toast.success('Profile photo removed')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Avatar name={displayName} src={user?.avatarUrl} size="xl" className="size-24 text-3xl ring-4 ring-white shadow" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-md ring-4 ring-white transition hover:bg-brand-700"
          aria-label="Change profile photo"
        >
          {busy ? <Spinner className="size-4 text-white" /> : <Camera className="size-4" />}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="mt-3 flex gap-2">
        <Button size="xs" variant="secondary" icon={Camera} onClick={() => inputRef.current?.click()} disabled={busy}>
          {user?.avatarUrl ? 'Change photo' : 'Upload photo'}
        </Button>
        {user?.avatarUrl && (
          <Button size="xs" variant="danger-ghost" icon={Trash2} onClick={remove} disabled={busy}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
