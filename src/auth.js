import bcrypt from 'bcryptjs';
import { getRows } from './db.js';

export function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, 10);
}

export function comparePassword(plainPassword, hash) {
  return bcrypt.compareSync(plainPassword, hash);
}

export async function verifyAuth(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }

  // Strictly enforce active status: Deactivated/resigned users are immediately blocked
  if (request.user && request.user.id) {
    const employees = await getRows('Employees');
    const emp = employees.find(e => e.id === request.user.id);
    if (!emp || emp.status !== 'active') {
      return reply.status(403).send({
        error: `Your account has been ${emp?.status === 'resigned' ? 'marked as resigned' : 'deactivated'}. You have been automatically logged out. Please contact company administration.`,
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
  }
}

export async function verifyAdmin(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }

  if (request.user && request.user.id) {
    const employees = await getRows('Employees');
    const emp = employees.find(e => e.id === request.user.id);
    if (!emp || emp.status !== 'active') {
      return reply.status(403).send({
        error: `Your account has been ${emp?.status === 'resigned' ? 'marked as resigned' : 'deactivated'}. You have been automatically logged out. Please contact administration.`,
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
    if (emp.role !== 'admin' && request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden: Admin access required' });
    }
  } else if (!request.user || request.user.role !== 'admin') {
    return reply.status(403).send({ error: 'Forbidden: Admin access required' });
  }
}
