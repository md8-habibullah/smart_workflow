import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Award, Plus, Trash2 } from 'lucide-react'
import { employeesApi, skillsApi } from '../lib/endpoints'
import { PROFICIENCY_LEVELS, PROFICIENCY_META } from '../lib/format'
import { Button, EmptyState, IconButton, Select, Spinner } from './ui'

/** View and edit one employee's skill profile (admins: anyone; employees: themselves). */
export default function SkillsEditor({ employeeId, editable = true }) {
  const queryClient = useQueryClient()
  const [skillId, setSkillId] = useState('')
  const [level, setLevel] = useState('INTERMEDIATE')

  const mine = useQuery({ queryKey: ['employee-skills', employeeId], queryFn: () => employeesApi.skills(employeeId) })
  const catalogue = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list, enabled: editable })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['employee-skills', employeeId] })
    queryClient.invalidateQueries({ queryKey: ['employee', String(employeeId)] })
    queryClient.invalidateQueries({ queryKey: ['recommendations'] })
  }

  const save = useMutation({
    mutationFn: ({ id, lvl }) => employeesApi.saveSkill(employeeId, Number(id), lvl),
    onSuccess: () => {
      invalidate()
      setSkillId('')
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id) => employeesApi.removeSkill(employeeId, id),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })

  const owned = new Set((mine.data || []).map((s) => s.skill_id))
  const available = (catalogue.data || []).filter((s) => !owned.has(s.id))

  if (mine.isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      {mine.data?.length === 0 ? (
        <EmptyState icon={Award} title="No skills recorded" description="Skills determine which tasks this person is eligible for." className="py-6" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {mine.data.map((s) => (
            <li key={s.skill_id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{s.skill_name}</p>
                <p className="text-xs text-slate-500">{s.skill_category}</p>
              </div>
              <div className="hidden w-24 sm:block">
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${s.numeric_score}%` }} />
                </div>
              </div>
              {editable ? (
                <>
                  <Select
                    value={s.proficiency_level}
                    onChange={(e) => save.mutate({ id: s.skill_id, lvl: e.target.value })}
                    className="w-36 py-1.5"
                    aria-label={`${s.skill_name} level`}
                  >
                    {PROFICIENCY_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {PROFICIENCY_META[l].label}
                      </option>
                    ))}
                  </Select>
                  <IconButton icon={Trash2} label={`Remove ${s.skill_name}`} variant="danger" onClick={() => remove.mutate(s.skill_id)} />
                </>
              ) : (
                <span className="text-sm font-medium text-slate-600">{PROFICIENCY_META[s.proficiency_level].label}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form
          className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (skillId) save.mutate({ id: skillId, lvl: level })
          }}
        >
          <Select value={skillId} onChange={(e) => setSkillId(e.target.value)} className="flex-1" aria-label="Skill to add">
            <option value="">{available.length ? 'Add a skill…' : 'All skills added'}</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.category})
              </option>
            ))}
          </Select>
          <Select value={level} onChange={(e) => setLevel(e.target.value)} className="sm:w-40" aria-label="Proficiency">
            {PROFICIENCY_LEVELS.map((l) => (
              <option key={l} value={l}>
                {PROFICIENCY_META[l].label}
              </option>
            ))}
          </Select>
          <Button type="submit" icon={Plus} disabled={!skillId} loading={save.isPending}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
