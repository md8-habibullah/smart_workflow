import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, Eye, File, FileImage, FileSpreadsheet, FileText, FileArchive, Paperclip, Trash2, UploadCloud } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { tasksApi } from '../lib/endpoints'
import { saveBlob } from '../lib/api'
import { timeAgo } from '../lib/format'
import { EmptyState, IconButton, Modal, Spinner, cn, useConfirm } from './ui'

const MAX_MB = 10
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.log,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx'

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const isImage = (mime) => mime?.startsWith('image/')

const fileIcon = (mime) => {
  if (isImage(mime)) return FileImage
  if (mime === 'application/pdf' || mime?.startsWith('text/') || mime?.includes('word')) return FileText
  if (mime?.includes('sheet') || mime?.includes('excel') || mime === 'text/csv') return FileSpreadsheet
  if (mime?.includes('zip')) return FileArchive
  return File
}

/** Image thumbnail loaded through the authenticated API (plain <img src> can't send the token). */
function Thumbnail({ taskId, attachment, onClick }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    tasksApi
      .downloadAttachment(taskId, attachment.id, true)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [taskId, attachment.id])

  return (
    <button type="button" onClick={() => onClick(url)} className="size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200" aria-label={`Preview ${attachment.original_name}`}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <FileImage className="m-auto size-5 text-slate-400" />}
    </button>
  )
}

export default function TaskAttachments({ task, onChange }) {
  const { user, isAdmin, employeeId } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(null)
  const [preview, setPreview] = useState(null)
  const [confirm, confirmDialog] = useConfirm()

  const isAssignee = task.assigned_employee_id && task.assigned_employee_id === employeeId
  const canUpload = (isAdmin || isAssignee) && task.status !== 'CANCELLED'
  const list = useQuery({ queryKey: ['task-attachments', task.id], queryFn: () => tasksApi.attachments(task.id) })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['task-attachments', task.id] })
    onChange?.()
  }

  const upload = useMutation({
    mutationFn: (files) => tasksApi.uploadAttachments(task.id, files, setProgress),
    onSuccess: (res) => {
      toast.success(res.message)
      refresh()
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setProgress(null),
  })

  const remove = useMutation({
    mutationFn: (a) => tasksApi.deleteAttachment(task.id, a.id),
    onSuccess: () => {
      toast.success('File deleted')
      refresh()
    },
    onError: (e) => toast.error(e.message),
  })

  const startUpload = (fileList) => {
    const files = [...fileList]
    if (!files.length) return
    if (files.length > 5) return toast.error('You can upload up to 5 files at a time.')
    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024)
    if (tooBig) return toast.error(`${tooBig.name} is larger than ${MAX_MB} MB.`)
    upload.mutate(files)
  }

  const download = async (a) => {
    try {
      saveBlob(await tasksApi.downloadAttachment(task.id, a.id), a.original_name)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const openPdf = async (a) => {
    try {
      const url = URL.createObjectURL(await tasksApi.downloadAttachment(task.id, a.id, true))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const onDelete = async (a) => {
    if (await confirm({ title: 'Delete file?', message: `"${a.original_name}" will be permanently removed.`, confirmLabel: 'Delete', tone: 'danger' })) {
      remove.mutate(a)
    }
  }

  return (
    <div>
      {confirmDialog}
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            startUpload(e.dataTransfer.files)
          }}
          onClick={() => !upload.isPending && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          className={cn(
            'mb-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition',
            dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              startUpload(e.target.files)
              e.target.value = ''
            }}
          />
          {upload.isPending ? (
            <div className="w-full max-w-xs">
              <p className="text-sm font-semibold text-slate-700">Uploading… {progress ?? 0}%</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress ?? 0}%` }} />
              </div>
            </div>
          ) : (
            <>
              <UploadCloud className="size-7 text-brand-600" />
              <p className="mt-2 text-sm font-semibold text-slate-800">Drop files here or click to browse</p>
              <p className="mt-0.5 text-xs text-slate-500">Images, PDF, Office documents, text, CSV or ZIP · up to 5 files · {MAX_MB} MB each</p>
            </>
          )}
        </div>
      )}

      {list.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : list.data?.length === 0 ? (
        <EmptyState icon={Paperclip} title="No files yet" description={canUpload ? 'Attach specs, screenshots or deliverables.' : undefined} className="py-6" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.data?.map((a) => {
            const Icon = fileIcon(a.mime_type)
            const canDelete = isAdmin || (a.uploaded_by === user?.id && task.status !== 'COMPLETED')
            return (
              <li key={a.id} className="flex items-center gap-3 py-3">
                {isImage(a.mime_type) ? (
                  <Thumbnail taskId={task.id} attachment={a} onClick={(url) => url && setPreview({ url, name: a.original_name })} />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Icon className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{a.original_name}</p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(a.size_bytes)} · {a.uploaded_by_name} · {timeAgo(a.created_at)}
                  </p>
                </div>
                {a.mime_type === 'application/pdf' && <IconButton icon={Eye} label="Open PDF" onClick={() => openPdf(a)} />}
                <IconButton icon={Download} label={`Download ${a.original_name}`} onClick={() => download(a)} />
                {canDelete && <IconButton icon={Trash2} label="Delete file" variant="danger" onClick={() => onDelete(a)} />}
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name || ''} size="xl">
        {preview && <img src={preview.url} alt={preview.name} className="mx-auto max-h-[70vh] rounded-lg" />}
      </Modal>
    </div>
  )
}
