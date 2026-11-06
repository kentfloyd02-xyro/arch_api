import { query } from '../../db/connection.js';
import { env } from '../../config/env.js';

export interface SupportInquiryPayload {
  customerName: string;
  customerEmail: string;
  customerId?: string | null;
  question: string;
  messages?: Array<{ sender: string; text: string; createdAt?: string }>;
}

const PREPARED_ANSWERS: Record<string, string> = {
  stock: 'Our catalog reflects real-time warehouse inventory directly from Cainta Central Plant. For bulk contractor allocations (>500 bags or 5,000 kg), logistics dispatch is scheduled directly with our operations team.',
  discount: 'You can use voucher code ARCHON20 for 20% OFF on eligible orders! In addition, an automatic 10% Contractor Volume Discount applies automatically to carts with 5 or more units.',
  delivery: 'Industrial freight is calculated at PHP 500 per 1,000 kg tier across Metro Manila and Rizal dispatch corridors. Apply voucher code FREESHIP at checkout to waive standard delivery fees!',
  return: 'Pending orders can be cancelled immediately from your Customer Portal with automatic stock restoration. Delivered materials can be returned within 7 days by submitting photos via the Request Return action.',
  specs: 'Archon Nell high-early strength mortars, non-shrink grouts, and admixtures comply with ASTM C150 & PNS standards. Technical Data Sheets (TDS) and Mill Test Certificates are available upon request.',
  payment: 'We support GCash with instant reference verification, Maya, Bank Transfer, Company Purchase Orders (PO) for corporate accounts, and Cash on Delivery (COD) for confirmed job sites.'
};

export async function answerQuestion(topicId?: string, userQuestion?: string): Promise<{ answer: string; source: 'gemini' | 'knowledge_base' }> {
  if (topicId && PREPARED_ANSWERS[topicId]) {
    return {
      answer: PREPARED_ANSWERS[topicId],
      source: 'knowledge_base'
    };
  }

  const promptText = userQuestion || (topicId ? PREPARED_ANSWERS[topicId] : 'Hello, how can I assist you?');

  if (env.GEMINI_API_KEY) {
    try {
      const systemInstruction = `You are the AI Technical Support Assistant for Archon Nell Incorporated, a leading industrial construction materials and chemical manufacturer in the Philippines.
Products offered: High-Strength Self-Leveling Mortar, Epoxy Crack Injection Resin, Concrete Superplasticizers, and Waterproofing Membranes.
Policies: Delivery is PHP 500 per 1,000 kg tier across Metro Manila and Rizal. Voucher codes include ARCHON20 (20% off) and FREESHIP (free freight). Returns are valid within 7 days with photo submission.
Keep answers concise, professional, accurate, and helpful.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemInstruction}\n\nCustomer question: ${promptText}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 600
            }
          })
        }
      );

      if (response.ok) {
        const json = await response.json();
        const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          return { answer: candidate.trim(), source: 'gemini' };
        }
      }
    } catch (err: any) {
      console.warn('[Support AI Service] Gemini fallback invoked:', err.message);
    }
  }

  return {
    answer: topicId && PREPARED_ANSWERS[topicId]
      ? PREPARED_ANSWERS[topicId]
      : 'Thank you for reaching out to Archon Nell Support Desk. Your inquiry has been routed to our technical support team.',
    source: 'knowledge_base'
  };
}

export async function createInquiry(payload: SupportInquiryPayload) {
  const ticketNumber = 'TK-' + Math.floor(10000 + Math.random() * 90000);
  const guestAccessToken = 'gst_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const initialMessages = Array.isArray(payload.messages) && payload.messages.length > 0
    ? payload.messages
    : [{ sender: 'user', text: payload.question, createdAt: new Date().toISOString() }];

  const isValidUuid = typeof payload.customerId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.customerId);
  const customerId = isValidUuid ? payload.customerId : null;

  const result = await query(
    `INSERT INTO shop.support_inquiries (
       ticket_number, customer_id, customer_name, customer_email, question, messages, guest_access_token, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
     RETURNING *`,
    [
      ticketNumber,
      customerId,
      payload.customerName,
      payload.customerEmail,
      payload.question,
      JSON.stringify(initialMessages),
      guestAccessToken
    ]
  );

  const row = result.rows[0];
  return {
    ...row,
    ticketNumber: row.ticket_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    guestAccessToken: row.guest_access_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getInquiries(
  statusFilter?: string,
  customerFilter?: { customerEmail?: string; customerId?: string }
) {
  let sql = `SELECT * FROM shop.support_inquiries`;
  const conditions: string[] = [];
  const params: any[] = [];

  if (statusFilter === 'open') {
    conditions.push(`status != 'closed'`);
  } else if (statusFilter === 'closed') {
    conditions.push(`status = 'closed'`);
  }

  if (customerFilter) {
    const isValidUuid = typeof customerFilter.customerId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerFilter.customerId);
    const validCustomerId = isValidUuid ? customerFilter.customerId : null;

    if (customerFilter.customerEmail && validCustomerId) {
      params.push(customerFilter.customerEmail.toLowerCase(), validCustomerId);
      conditions.push(`(LOWER(customer_email) = $${params.length - 1} OR customer_id = $${params.length})`);
    } else if (customerFilter.customerEmail) {
      params.push(customerFilter.customerEmail.toLowerCase());
      conditions.push(`LOWER(customer_email) = $${params.length}`);
    } else if (validCustomerId) {
      params.push(validCustomerId);
      conditions.push(`customer_id = $${params.length}`);
    }
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` ORDER BY created_at DESC`;

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    ...row,
    ticketNumber: row.ticket_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    guestAccessToken: row.guest_access_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function getInquiryById(id: string) {
  const result = await query(
    `SELECT * FROM shop.support_inquiries
     WHERE id::text = $1 OR ticket_number = $1
     LIMIT 1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'INQUIRY_NOT_FOUND', message: 'Support ticket not found.' };
  }

  const row = result.rows[0];
  return {
    ...row,
    ticketNumber: row.ticket_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    guestAccessToken: row.guest_access_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function addMessage(id: string, text: string, sender: 'user' | 'admin' = 'user') {
  const inquiry = await getInquiryById(id);
  const currentMessages = Array.isArray(inquiry.messages) ? inquiry.messages : [];
  const newMessage = {
    _id: 'msg_' + Date.now(),
    sender,
    text,
    createdAt: new Date().toISOString()
  };

  const updatedMessages = [...currentMessages, newMessage];

  const updateResult = await query(
    `UPDATE shop.support_inquiries
     SET messages = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(updatedMessages), inquiry.id]
  );

  const row = updateResult.rows[0];
  return {
    success: true,
    message: newMessage,
    inquiry: {
      ...row,
      ticketNumber: row.ticket_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  };
}

export async function replyInquiry(id: string, reply: string) {
  const inquiry = await getInquiryById(id);
  const currentMessages = Array.isArray(inquiry.messages) ? inquiry.messages : [];
  const adminMessage = {
    _id: 'msg_' + Date.now(),
    sender: 'admin',
    text: reply,
    createdAt: new Date().toISOString()
  };

  const updatedMessages = [...currentMessages, adminMessage];

  const updateResult = await query(
    `UPDATE shop.support_inquiries
     SET messages = $1, reply = $2, replied_at = NOW(), updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [JSON.stringify(updatedMessages), reply, inquiry.id]
  );

  const row = updateResult.rows[0];
  return {
    success: true,
    reply,
    inquiry: {
      ...row,
      ticketNumber: row.ticket_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  };
}

export async function closeInquiry(id: string) {
  const inquiry = await getInquiryById(id);

  const updateResult = await query(
    `UPDATE shop.support_inquiries
     SET status = 'closed', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [inquiry.id]
  );

  const row = updateResult.rows[0];
  return {
    ...row,
    ticketNumber: row.ticket_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
