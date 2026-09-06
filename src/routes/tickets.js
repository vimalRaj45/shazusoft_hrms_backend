import { getRows, addRow, updateRow, deleteRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { sendPushNotification, broadcastPushNotification } from '../pushService.js';
import { dispatchNotification } from '../inAppNotificationService.js';

function escapeRegex(str) {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check if user is creator, assigned, or mentioned in subject, description, messages, or logs
function checkUserParticipation(user, ticket, messages = [], commLogs = []) {
  if (!user || !ticket) return false;
  if (user.role === 'admin' || user.role === 'manager') return true;
  if (ticket.creator_id === user.id) return true;

  // Assigned to user
  if (ticket.assigned_to_id) {
    const assignedIds = ticket.assigned_to_id.split(',').map(s => s.trim());
    if (assignedIds.includes(user.id)) return true;
  }

  const userName = (user.name || '').trim();
  const firstName = userName.split(' ')[0];
  const nameRegex = userName ? new RegExp(`@${escapeRegex(userName)}\\b`, 'i') : null;
  const firstNameRegex = firstName && firstName.length >= 3 ? new RegExp(`@${escapeRegex(firstName)}\\b`, 'i') : null;
  const idRegex = new RegExp(`@${escapeRegex(user.id)}\\b`, 'i');

  const ticketContent = `${ticket.subject || ''} ${ticket.description || ''}`;
  if (
    (nameRegex && nameRegex.test(ticketContent)) ||
    (firstNameRegex && firstNameRegex.test(ticketContent)) ||
    idRegex.test(ticketContent)
  ) {
    return true;
  }

  // Check ticket messages
  for (const m of messages) {
    if (m.ticket_id === ticket.id) {
      if (m.sender_id === user.id) return true;
      const text = m.message || '';
      if (
        (nameRegex && nameRegex.test(text)) ||
        (firstNameRegex && firstNameRegex.test(text)) ||
        idRegex.test(text)
      ) {
        return true;
      }
    }
  }

  // Check Communications_Log
  for (const log of commLogs) {
    if (
      log.type === 'mention' &&
      log.recipient_id === user.id &&
      (log.metadata_json?.includes(ticket.id) || log.metadata_json?.includes(ticket.ticket_number))
    ) {
      return true;
    }
  }

  return false;
}

// Process and dispatch @mentions in ticket description or message
async function processMentions({ content, explicitMentions, ticket, sender, excludeIds = [], allEmployees }) {
  const mentionedIds = new Set(Array.isArray(explicitMentions) ? explicitMentions : []);
  const now = new Date().toISOString();

  allEmployees.forEach(emp => {
    if (emp.status === 'active' && emp.id !== sender.id) {
      const fullNameRegex = new RegExp(`@${escapeRegex(emp.name)}\\b`, 'i');
      const firstName = (emp.name || '').split(' ')[0];
      const firstNameRegex = firstName && firstName.length >= 3 ? new RegExp(`@${escapeRegex(firstName)}\\b`, 'i') : null;
      const idRegex = new RegExp(`@${escapeRegex(emp.id)}\\b`, 'i');

      if (fullNameRegex.test(content) || (firstNameRegex && firstNameRegex.test(content)) || idRegex.test(content)) {
        mentionedIds.add(emp.id);
      }
    }
  });

  for (const empId of mentionedIds) {
    if (empId !== sender.id && !excludeIds.includes(empId)) {
      const targetEmp = allEmployees.find(e => e.id === empId);
      dispatchNotification({
        recipientId: empId,
        title: `💬 ${sender.name} mentioned you`,
        message: `"${content.trim().slice(0, 90)}" — Ticket #${ticket.ticket_number}`,
        type: 'ticket',
        targetTab: 'chat-hub',
        targetUrl: '/?tab=chat-hub',
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number },
        senderRole: sender.role || 'employee',
        isCrud: false
      }).catch(() => {});

      await addRow('Communications_Log', {
        id: `COMM-${Date.now()}-${empId}`,
        type: 'mention',
        sender_id: sender.id,
        sender_name: sender.name,
        recipient_id: empId,
        recipient_name: targetEmp?.name || empId,
        subject: `Mentioned in ${ticket.ticket_number}`,
        message: content.trim().slice(0, 160),
        metadata_json: JSON.stringify({ ticket_id: ticket.id, ticket_number: ticket.ticket_number }),
        created_at: now
      }).catch(() => {});
    }
  }
  return Array.from(mentionedIds);
}

export default async function ticketsRoutes(fastify, options) {
  // GET /api/tickets - List all support tickets / issues
  fastify.get('/', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { status, category, priority, search } = request.query || {};
    const isAdmin = request.user.role === 'admin' || request.user.role === 'manager';

    const [allTickets, allMessages, allCommLogs] = await Promise.all([
      getRows('Support_Tickets'),
      getRows('Ticket_Messages'),
      getRows('Communications_Log')
    ]);

    // Role-based visibility: Admins see all, employees see tickets they created OR are mentioned/participating in
    let filtered = allTickets.filter(t => checkUserParticipation(request.user, t, allMessages, allCommLogs));

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
        is_creator: ticket.creator_id === request.user.id,
        is_mentioned: ticket.creator_id !== request.user.id && !isAdmin,
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

    // Calculate Summary Metrics for accessible tickets
    const baseList = allTickets.filter(t => checkUserParticipation(request.user, t, allMessages, allCommLogs));
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
      priority,
      mentions
    } = request.body || {};

    if (!subject || !category || !description) {
      return reply.status(400).send({
        error: 'Subject, category, and issue description are required.'
      });
    }

    const allTickets = await getRows('Support_Tickets');
    const allEmployees = await getRows('Employees');
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

    // Real-Time In-App & Push notification to admin of new support ticket
    dispatchNotification({
      recipientId: 'EMP-ADMIN-01',
      title: 'New Support Ticket 🎫',
      message: `${request.user.name} raised ${ticketNumber}: "${subject}" [${priority || 'Medium'} priority].`,
      type: 'ticket',
      targetTab: 'chat-hub',
      targetUrl: '/?tab=chat-hub',
      metadata: { ticketId, ticketNumber, priority },
      senderRole: request.user?.role || 'employee',
      isCrud: true
    }).catch(() => {});

    // Detect and notify any @mentioned staff members in initial ticket description & subject
    const initialContent = `${subject} ${description}`;
    await processMentions({
      content: initialContent,
      explicitMentions: mentions,
      ticket: savedTicket,
      sender: request.user,
      excludeIds: ['EMP-ADMIN-01'],
      allEmployees
    });

    return {
      message: `Support ticket ${ticketNumber} raised successfully.`,
      ticket: savedTicket
    };
  });

  // GET /api/tickets/:id - Get ticket details
  fastify.get('/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const [allTickets, allMessages, allCommLogs] = await Promise.all([
      getRows('Support_Tickets'),
      getRows('Ticket_Messages'),
      getRows('Communications_Log')
    ]);
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    // Access check: Admin or participant (creator, assigned, or mentioned)
    const isParticipant = checkUserParticipation(request.user, ticket, allMessages, allCommLogs);
    if (!isParticipant) {
      return reply.status(403).send({ error: 'Unauthorized to view this ticket.' });
    }

    return {
      ticket: {
        ...ticket,
        is_creator: ticket.creator_id === request.user.id,
        is_mentioned: ticket.creator_id !== request.user.id && request.user.role !== 'admin' && request.user.role !== 'manager'
      }
    };
  });

  // GET /api/tickets/:id/messages - Get chat messages for ticket
  fastify.get('/:id/messages', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const [allTickets, allMessages, allCommLogs] = await Promise.all([
      getRows('Support_Tickets'),
      getRows('Ticket_Messages'),
      getRows('Communications_Log')
    ]);
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    const isParticipant = checkUserParticipation(request.user, ticket, allMessages, allCommLogs);
    if (!isParticipant) {
      return reply.status(403).send({ error: 'Unauthorized to view these messages.' });
    }

    const ticketMessages = allMessages
      .filter(m => m.ticket_id === ticket.id)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    return { ticket, messages: ticketMessages };
  });

  // GET /api/tickets/staff-list - Lightweight list of active staff for @mention autocomplete
  fastify.get('/staff-list', { preHandler: [verifyAuth] }, async (request, reply) => {
    const allEmps = await getRows('Employees');
    const staff = allEmps
      .filter(e => e.status === 'active')
      .map(e => ({
        id: e.id,
        name: e.name,
        email: e.email,
        department: e.department || '',
        designation: e.designation || '',
        role: e.role || 'employee',
        avatar_url: e.avatar_url || ''
      }));
    return { staff };
  });

  // POST /api/tickets/:id/messages - Send message in conversation thread
  fastify.post('/:id/messages', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const { message, attachment_url, is_internal_note, mentions } = request.body || {};

    if (!message || !message.trim()) {
      return reply.status(400).send({ error: 'Message cannot be empty.' });
    }

    const [allTickets, allMessages, allCommLogs, allEmployees] = await Promise.all([
      getRows('Support_Tickets'),
      getRows('Ticket_Messages'),
      getRows('Communications_Log'),
      getRows('Employees')
    ]);
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    const isAdmin = request.user.role === 'admin' || request.user.role === 'manager';
    const isParticipant = checkUserParticipation(request.user, ticket, allMessages, allCommLogs);
    if (!isAdmin && !isParticipant) {
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

    // Notifications:
    // If Admin sends: notify ticket creator
    // If Creator sends: notify admin
    // If Mentioned Participant sends: notify creator AND admin
    const excludedNotify = [request.user.id];
    const snippet = message.trim().slice(0, 80) + (message.trim().length > 80 ? '...' : '');

    if (isAdmin) {
      dispatchNotification({
        recipientId: ticket.creator_id,
        title: 'New Message on Ticket 💬',
        message: `${request.user.name} replied on ${ticket.ticket_number}: "${snippet}".`,
        type: 'ticket',
        targetTab: 'chat-hub',
        targetUrl: '/?tab=chat-hub',
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number },
        senderRole: request.user?.role || 'admin',
        isCrud: true
      }).catch(() => {});
      excludedNotify.push(ticket.creator_id);
    } else if (request.user.id === ticket.creator_id) {
      dispatchNotification({
        recipientId: 'EMP-ADMIN-01',
        title: 'New Message on Ticket 💬',
        message: `${request.user.name} replied on ${ticket.ticket_number}: "${snippet}".`,
        type: 'ticket',
        targetTab: 'chat-hub',
        targetUrl: '/?tab=chat-hub',
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number },
        senderRole: request.user?.role || 'employee',
        isCrud: true
      }).catch(() => {});
      excludedNotify.push('EMP-ADMIN-01');
    } else {
      // Mentioned participant replied: notify both ticket creator and admin
      dispatchNotification({
        recipientId: ticket.creator_id,
        title: 'Participant Replied on Ticket 💬',
        message: `${request.user.name} replied on ${ticket.ticket_number}: "${snippet}".`,
        type: 'ticket',
        targetTab: 'chat-hub',
        targetUrl: '/?tab=chat-hub',
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number },
        senderRole: request.user?.role || 'employee',
        isCrud: true
      }).catch(() => {});
      dispatchNotification({
        recipientId: 'EMP-ADMIN-01',
        title: 'Participant Replied on Ticket 💬',
        message: `${request.user.name} replied on ${ticket.ticket_number}: "${snippet}".`,
        type: 'ticket',
        targetTab: 'chat-hub',
        targetUrl: '/?tab=chat-hub',
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number },
        senderRole: request.user?.role || 'employee',
        isCrud: true
      }).catch(() => {});
      excludedNotify.push(ticket.creator_id, 'EMP-ADMIN-01');
    }

    // Detect and process @mentions in message
    await processMentions({
      content: message.trim(),
      explicitMentions: mentions,
      ticket,
      sender: request.user,
      excludeIds: excludedNotify,
      allEmployees
    });

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

    const [allTickets, allMessages, allCommLogs] = await Promise.all([
      getRows('Support_Tickets'),
      getRows('Ticket_Messages'),
      getRows('Communications_Log')
    ]);
    const ticket = allTickets.find(t => t.id === id || t.ticket_number === id);

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found.' });
    }

    const isAdmin = request.user.role === 'admin' || request.user.role === 'manager';
    const isParticipant = checkUserParticipation(request.user, ticket, allMessages, allCommLogs);
    if (!isAdmin && !isParticipant) {
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

    // Notify ticket creator of status change
    if (ticket.creator_id && ticket.creator_id !== request.user.id) {
      dispatchNotification({
        recipientId: ticket.creator_id,
        title: `Ticket ${status} ${status === 'Resolved' ? '✅' : 'ℹ️'}`,
        message: `Ticket #${ticket.ticket_number} marked as ${status} by ${request.user.name}.${resolution_notes ? ` Notes: ${resolution_notes}` : ''}`,
        type: 'ticket',
        targetTab: 'chat-hub',
        targetUrl: '/?tab=chat-hub',
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number, status },
        senderRole: request.user?.role || 'admin',
        isCrud: true
      }).catch(() => {});
    }

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

    // Real-Time In-App & Push broadcast to ALL employees
    dispatchNotification({
      recipientId: 'ALL',
      title: title.trim(),
      message: content.trim().slice(0, 160),
      type: 'broadcast',
      targetTab: 'announcements',
      targetUrl: '/?tab=announcements',
      metadata: { broadcastId: saved.id, priority: saved.priority },
      sendPush: true,
      senderRole: request.user?.role || 'admin',
      isCrud: false
    }).catch(() => {});

    return {
      message: 'Company announcement broadcasted successfully.',
      broadcast: saved
    };
  });
}
