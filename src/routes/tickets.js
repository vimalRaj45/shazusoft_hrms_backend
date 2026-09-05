import { getRows, addRow, updateRow, deleteRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';

export default async function ticketsRoutes(fastify, options) {
  // GET /api/tickets - List all support tickets / issues
  fastify.get('/', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { status, category, priority, search } = request.query || {};
    const isAdmin = request.user.role === 'admin' || request.user.role === 'manager';

    const [allTickets, allMessages] = await Promise.all([
      getRows('Support_Tickets'),
      getRows('Ticket_Messages')
    ]);

    // Role-based visibility
    let filtered = allTickets;
    if (!isAdmin) {
      filtered = allTickets.filter(t => t.creator_id === request.user.id);
    }

    // Apply filters
    if (status && status !== 'all') {
      filtered = filtered.filter(t => (t.status || '').toLowerCase() === status.toLowerCase());
    }
    if (category && category !== 'all') {
      filtered = filtered.filter(t => (t.category || '').toLowerCase() === category.toLowerCase());
    }
    if (priority && priority !== 'all') {
      filtered = filtered.filter(t => (t.priority || '').toLowerCase() === priority.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        (t.subject || '').toLowerCase().includes(q) ||
        (t.ticket_number || '').toLowerCase().includes(q) ||
        (t.creator_name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    // Attach message counts and latest message snippet
    const enriched = filtered.map(ticket => {
      const messages = allMessages.filter(m => m.ticket_id === ticket.id);
      const sortedMessages = messages.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
      const latest = sortedMessages[sortedMessages.length - 1] || null;
      return {
        ...ticket,
        message_count: messages.length,
        latest_message: latest ? {
          message: latest.message,
          sender_name: latest.sender_name,
          sender_role: latest.sender_role,
          created_at: latest.created_at
        } : null
      };
    });

    // Sort by updated_at or created_at descending
    enriched.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

    // Calculate Summary Metrics
    const baseList = isAdmin ? allTickets : allTickets.filter(t => t.creator_id === request.user.id);
    const metrics = {
      total: baseList.length,
      open: baseList.filter(t => t.status === 'Open').length,
      inProgress: baseList.filter(t => t.status === 'In-Progress').length,
      resolved: baseList.filter(t => t.status === 'Resolved').length,
      closed: baseList.filter(t => t.status === 'Closed').length
    };

    return { tickets: enriched, metrics };
  });

  // POST /api/tickets - Raise a new support ticket / issue
  fastify.post('/', { preHandler: [verifyAuth] }, async (request, reply) => {
    const {
      category,
      subject,
      description,
      priority
    } = request.body || {};

    if (!subject || !category || !description) {
      return reply.status(400).send({
        error: 'Subject, category, and issue description are required.'
      });
    }

    const allTickets = await getRows('Support_Tickets');
    const ticketSeq = allTickets.length + 101;
    const ticketNumber = `TKT-${ticketSeq}`;
    const ticketId = `TKT-${Date.now()}-${request.user.id}`;
    const now = new Date().toISOString();

    const newTicket = {
      id: ticketId,
      ticket_number: ticketNumber,
      category,
      subject,
      description,
      priority: priority || 'Medium',
      status: 'Open',
      creator_id: request.user.id,
      creator_name: request.user.name,
      assigned_to_id: '',
      assigned_to_name: 'Management Team',
      resolution_notes: '',
      resolved_at: '',
      created_at: now,
      updated_at: now
    };

    const savedTicket = await addRow('Support_Tickets', newTicket);

    // Initial message in conversation thread
    await addRow('Ticket_Messages', {
      id: `MSG-${Date.now()}-1`,
      ticket_id: ticketId,
      sender_id: request.user.id,
      sender_name: request.user.name,
      sender_role: request.user.role || 'employee',
      message: description,
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: now
    });

    return {
      message: `Support ticket ${ticketNumber} raised successfully.`,
      ticket: savedTicket
    };
  });

  // GET /api/tickets/:id - Get ticket details
  fastify.get('/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const allTickets = await getRows('Support_Tickets');
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    // Access check
    if (request.user.role !== 'admin' && ticket.creator_id !== request.user.id) {
      return reply.status(403).send({ error: 'Unauthorized to view this ticket.' });
    }

    return { ticket };
  });

  // GET /api/tickets/:id/messages - Get chat messages for ticket
  fastify.get('/:id/messages', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const allTickets = await getRows('Support_Tickets');
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    if (request.user.role !== 'admin' && ticket.creator_id !== request.user.id) {
      return reply.status(403).send({ error: 'Unauthorized to view these messages.' });
    }

    const allMessages = await getRows('Ticket_Messages');
    const ticketMessages = allMessages
      .filter(m => m.ticket_id === ticket.id)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    return { ticket, messages: ticketMessages };
  });

  // POST /api/tickets/:id/messages - Send message in conversation thread
  fastify.post('/:id/messages', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const { message, attachment_url, is_internal_note } = request.body || {};

    if (!message || !message.trim()) {
      return reply.status(400).send({ error: 'Message cannot be empty.' });
    }

    const allTickets = await getRows('Support_Tickets');
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    const isAdmin = request.user.role === 'admin' || request.user.role === 'manager';
    if (!isAdmin && ticket.creator_id !== request.user.id) {
      return reply.status(403).send({ error: 'Unauthorized to post to this ticket.' });
    }

    const now = new Date().toISOString();
    const msgId = `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newMsg = {
      id: msgId,
      ticket_id: ticket.id,
      sender_id: request.user.id,
      sender_name: request.user.name,
      sender_role: request.user.role || 'employee',
      message: message.trim(),
      attachment_url: attachment_url || '',
      is_internal_note: is_internal_note ? 'TRUE' : 'FALSE',
      created_at: now
    };

    const savedMsg = await addRow('Ticket_Messages', newMsg);

    // Auto-update ticket status: If Admin replies to an 'Open' ticket, change to 'In-Progress'
    const updatePayload = { updated_at: now };
    if (isAdmin && ticket.status === 'Open') {
      updatePayload.status = 'In-Progress';
      updatePayload.assigned_to_id = request.user.id;
      updatePayload.assigned_to_name = request.user.name;
    }

    await updateRow('Support_Tickets', 'id', ticket.id, updatePayload);

    return {
      message: 'Message sent successfully.',
      data: savedMsg
    };
  });

  // PATCH /api/tickets/:id/status - Update ticket status & resolution notes
  fastify.patch('/:id/status', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const { status, resolution_notes } = request.body || {};

    const validStatuses = ['Open', 'In-Progress', 'Resolved', 'Closed'];
    if (!status || !validStatuses.includes(status)) {
      return reply.status(400).send({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const allTickets = await getRows('Support_Tickets');
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    const isAdmin = request.user.role === 'admin' || request.user.role === 'manager';
    // Employees can only mark their own tickets as Resolved or Closed
    if (!isAdmin && ticket.creator_id !== request.user.id) {
      return reply.status(403).send({ error: 'Unauthorized to update this ticket.' });
    }

    const now = new Date().toISOString();
    const updateData = {
      status,
      updated_at: now
    };

    if (resolution_notes !== undefined) {
      updateData.resolution_notes = resolution_notes;
    }
    if (status === 'Resolved' || status === 'Closed') {
      updateData.resolved_at = now;
    }

    const updated = await updateRow('Support_Tickets', 'id', ticket.id, updateData);

    // System notification message in chat
    await addRow('Ticket_Messages', {
      id: `SYS-${Date.now()}`,
      ticket_id: ticket.id,
      sender_id: 'SYSTEM',
      sender_name: 'HRMS Notification',
      sender_role: 'system',
      message: `Ticket status changed to "${status}" by ${request.user.name}.${resolution_notes ? ` Notes: ${resolution_notes}` : ''}`,
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: now
    });

    return {
      message: `Ticket ${ticket.ticket_number} marked as ${status}.`,
      ticket: updated
    };
  });

  // GET /api/tickets/broadcasts/all - List company broadcast announcements
  fastify.get('/broadcasts/all', { preHandler: [verifyAuth] }, async (request, reply) => {
    const broadcasts = await getRows('Broadcasts');
    broadcasts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return { broadcasts };
  });

  // POST /api/tickets/broadcasts - Admin post broadcast announcement
  fastify.post('/broadcasts', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { title, content, priority } = request.body || {};

    if (!title || !content) {
      return reply.status(400).send({ error: 'Title and content are required for broadcast.' });
    }

    const newBroadcast = {
      id: `BCAST-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      priority: priority || 'Normal',
      created_by_id: request.user.id,
      created_by_name: request.user.name,
      created_at: new Date().toISOString()
    };

    const saved = await addRow('Broadcasts', newBroadcast);

    return {
      message: 'Company announcement broadcasted successfully.',
      broadcast: saved
    };
  });
}
