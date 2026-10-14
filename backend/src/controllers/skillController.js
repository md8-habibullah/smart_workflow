import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, forbidden, notFound, parseId } from '../utils/errors.js';
import * as skillRepository from '../repositories/skillRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';
import { skillSchema, skillUpdateSchema, employeeSkillSchema } from '../validators/schemas.js';

export const getSkills = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await skillRepository.getAllSkills() });
});

export const createSkill = asyncHandler(async (req, res) => {
  const { name, category, description } = skillSchema.parse(req.body);
  if (await skillRepository.findByName(name)) throw conflict('A skill with this name already exists.');
  const id = await skillRepository.createSkill(name, category, description);
  res.status(201).json({ success: true, data: await skillRepository.getSkillById(id) });
});

export const updateSkill = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'skill id');
  const data = skillUpdateSchema.parse(req.body);
  if (!(await skillRepository.getSkillById(id))) throw notFound('Skill not found');
  if (data.name) {
    const existing = await skillRepository.findByName(data.name);
    if (existing && existing.id !== id) throw conflict('A skill with this name already exists.');
  }
  await skillRepository.updateSkill(id, data);
  res.status(200).json({ success: true, data: await skillRepository.getSkillById(id) });
});

export const deleteSkill = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'skill id');
  if (!(await skillRepository.getSkillById(id))) throw notFound('Skill not found');
  if ((await skillRepository.countTaskUsage(id)) > 0) {
    throw conflict('Skill is required by one or more tasks and cannot be deleted.');
  }
  await skillRepository.deleteSkill(id);
  res.status(200).json({ success: true, message: 'Skill deleted' });
});

// ---- employee skill profile: admins manage anyone, employees manage their own

const resolveEmployee = async (req) => {
  const employeeId = parseId(req.params.id, 'employee id');
  if (!req.user.isAdmin && req.user.employeeId !== employeeId) {
    throw forbidden('You can only manage your own skills.');
  }
  if (!(await employeeRepository.findEmployeeById(employeeId))) throw notFound('Employee not found');
  return employeeId;
};

export const getEmployeeSkills = asyncHandler(async (req, res) => {
  const employeeId = await resolveEmployee(req);
  res.status(200).json({ success: true, data: await skillRepository.getEmployeeSkills(employeeId) });
});

export const addEmployeeSkill = asyncHandler(async (req, res) => {
  const employeeId = await resolveEmployee(req);
  const { skillId, proficiencyLevel } = employeeSkillSchema.parse(req.body);
  if (!(await skillRepository.getSkillById(skillId))) throw badRequest('Skill does not exist.');
  await skillRepository.addOrUpdateEmployeeSkill(employeeId, skillId, proficiencyLevel);
  res.status(200).json({
    success: true,
    message: 'Employee skill saved',
    data: await skillRepository.getEmployeeSkills(employeeId)
  });
});

export const removeEmployeeSkill = asyncHandler(async (req, res) => {
  const employeeId = await resolveEmployee(req);
  const skillId = parseId(req.params.skillId, 'skill id');
  const result = await skillRepository.removeEmployeeSkill(employeeId, skillId);
  if (result.affectedRows === 0) throw notFound('Employee does not have this skill');
  res.status(200).json({ success: true, message: 'Employee skill removed' });
});
