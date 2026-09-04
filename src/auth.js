import bcrypt from 'bcryptjs';

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
}

export async function verifyAdmin(request, reply) {
  try {
    await request.jwtVerify();
    if (!request.user || request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden: Admin access required' });
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
}
