// Break Time Tracking Module has been permanently removed per system requirements.
export default async function breakRoutes(fastify, options) {
  fastify.all('/*', async (request, reply) => {
    return reply.status(404).send({ error: 'Break tracking module has been permanently disabled.' });
  });
}
