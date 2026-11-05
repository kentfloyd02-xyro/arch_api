import { query } from '../../db/connection.js';

// ------------------------------------------------------------------------------
// CATEGORIES & PRODUCTS
// ------------------------------------------------------------------------------

export async function getAllCategories() {
  const result = await query(
    `SELECT c.*, COUNT(p.id)::int AS product_count
     FROM shop.categories c
     LEFT JOIN shop.products p ON p.category_id = c.id AND p.is_active = TRUE
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
  return result.rows;
}

export async function createCategory(name: string, slug: string, description?: string) {
  const result = await query(
    `INSERT INTO shop.categories (name, slug, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, slug.toLowerCase(), description || null]
  );
  return result.rows[0];
}

export async function getAllProducts(options: {
  categorySlug?: string;
  categoryId?: string;
  search?: string;
  includeInactive?: boolean;
} = {}) {
  let sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug,
           COALESCE(AVG(r.rating), 0)::numeric(3, 2) AS average_rating,
           COUNT(r.id)::int AS review_count
    FROM shop.products p
    LEFT JOIN shop.categories c ON c.id = p.category_id
    LEFT JOIN shop.reviews r ON r.product_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (!options.includeInactive) {
    sql += ` AND p.is_active = TRUE`;
  }
  if (options.categoryId) {
    params.push(options.categoryId);
    sql += ` AND p.category_id = $${params.length}`;
  }
  if (options.categorySlug && options.categorySlug !== 'all') {
    params.push(options.categorySlug);
    sql += ` AND c.slug = $${params.length}`;
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    sql += ` AND (p.title ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
  }

  sql += ` GROUP BY p.id, c.name, c.slug ORDER BY p.created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function getProductById(id: string) {
  const result = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            COALESCE(AVG(r.rating), 0)::numeric(3, 2) AS average_rating,
            COUNT(r.id)::int AS review_count
     FROM shop.products p
     LEFT JOIN shop.categories c ON c.id = p.category_id
     LEFT JOIN shop.reviews r ON r.product_id = p.id
     WHERE p.id = $1 OR p.custom_id = $1
     GROUP BY p.id, c.name, c.slug`,
    [id]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' };
  }
  return result.rows[0];
}

export async function createProduct(data: {
  categoryId?: string;
  customId?: string;
  title: string;
  description?: string;
  price: number;
  stock?: number;
  sku?: string;
  images?: string[];
  specs?: Record<string, any>;
}) {
  const result = await query(
    `INSERT INTO shop.products (
       category_id, custom_id, title, description, price, stock, sku, images, specs
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.categoryId || null,
      data.customId || `prod-${Date.now().toString().slice(-5)}`,
      data.title,
      data.description || null,
      data.price,
      data.stock || 0,
      data.sku || null,
      JSON.stringify(data.images || []),
      JSON.stringify(data.specs || {})
    ]
  );
  return result.rows[0];
}

export async function updateProduct(id: string, data: Partial<{
  categoryId: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  images: string[];
  specs: Record<string, any>;
  isActive: boolean;
}>) {
  const fields: string[] = [];
  const params: any[] = [id];

  const map: Record<string, string> = {
    categoryId: 'category_id',
    title: 'title',
    description: 'description',
    price: 'price',
    stock: 'stock',
    sku: 'sku',
    isActive: 'is_active'
  };

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (key === 'images' || key === 'specs') {
        params.push(JSON.stringify(val));
        fields.push(`${key} = $${params.length}`);
      } else if (map[key]) {
        params.push(val);
        fields.push(`${map[key]} = $${params.length}`);
      }
    }
  }

  if (fields.length === 0) {
    return getProductById(id);
  }

  fields.push('updated_at = NOW()');
  const sql = `UPDATE shop.products SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await query(sql, params);
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// VOUCHERS
// ------------------------------------------------------------------------------

export async function validateVoucher(code: string, subtotal: number) {
  const result = await query(
    `SELECT * FROM shop.vouchers WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
    [code]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'INVALID_VOUCHER', message: 'Voucher code is invalid or inactive.' };
  }

  const v = result.rows[0];

  if (v.expires_at && new Date(v.expires_at) < new Date()) {
    throw { statusCode: 400, code: 'EXPIRED_VOUCHER', message: 'This voucher has expired.' };
  }

  if (v.usage_limit && v.used_count >= v.usage_limit) {
    throw { statusCode: 400, code: 'VOUCHER_EXHAUSTED', message: 'This voucher has reached its redemption limit.' };
  }

  if (subtotal < Number(v.min_spend)) {
    throw {
      statusCode: 400,
      code: 'MIN_SPEND_NOT_MET',
      message: `Minimum spend of ₱${Number(v.min_spend).toLocaleString()} required for this voucher.`
    };
  }

  let discount = 0;
  if (v.discount_type === 'PERCENTAGE') {
    discount = (subtotal * Number(v.discount_value)) / 100;
    if (v.max_discount && discount > Number(v.max_discount)) {
      discount = Number(v.max_discount);
    }
  } else {
    discount = Number(v.discount_value);
  }

  return {
    valid: true,
    code: v.code,
    discountAmount: Number(discount.toFixed(2)),
    voucher: v
  };
}

export async function getVouchers() {
  const result = await query(
    `SELECT id, code, discount_type, discount_value, min_spend, max_discount, usage_limit, used_count, expires_at, is_active
     FROM shop.vouchers
     WHERE is_active = TRUE
     ORDER BY created_at DESC`
  );

  return result.rows.map((v) => ({
    id: v.id,
    code: v.code,
    discountType: v.discount_type,
    discountValue: Number(v.discount_value),
    minSpend: Number(v.min_spend),
    maxDiscount: v.max_discount ? Number(v.max_discount) : null,
    usageLimit: v.usage_limit,
    usedCount: v.used_count,
    expiresAt: v.expires_at,
    isActive: v.is_active
  }));
}

// ------------------------------------------------------------------------------
// ORDERS & CHECKOUT (WITH AUTO-DISPATCH CREATION)
// ------------------------------------------------------------------------------

export async function createOrder(data: {
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  paymentMethod: string;
  gcashRefNumber?: string;
  proofImage?: string;
  subtotal: number;
  discount?: number;
  total: number;
  voucherCode?: string;
  items: Array<{
    productId?: string;
    title: string;
    price: number;
    quantity: number;
    total: number;
  }>;
}) {
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const defaultTrackingSteps = [
    { step: 'Order Placed', time: new Date().toISOString(), done: true },
    { step: 'Factory Packed', time: '', done: false },
    { step: 'In Transit', time: '', done: false },
    { step: 'Out for Delivery', time: '', done: false },
    { step: 'Delivered', time: '', done: false }
  ];

  // 1. Insert Order
  const orderRes = await query(
    `INSERT INTO shop.orders (
       order_number, user_id, customer_name, customer_email, customer_phone,
       delivery_address, delivery_notes, payment_method, payment_status,
       gcash_ref_number, proof_image, subtotal, discount, total,
       delivery_status, current_tracking_step, tracking_steps
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Pending', 'Order Placed', $15)
     RETURNING *`,
    [
      orderNumber,
      data.userId || null,
      data.customerName,
      data.customerEmail,
      data.customerPhone,
      data.deliveryAddress,
      data.deliveryNotes || '',
      data.paymentMethod,
      data.paymentMethod === 'COD' ? 'Pending' : data.gcashRefNumber ? 'Paid' : 'Pending',
      data.gcashRefNumber || null,
      data.proofImage || null,
      data.subtotal,
      data.discount || 0,
      data.total,
      JSON.stringify(defaultTrackingSteps)
    ]
  );

  const order = orderRes.rows[0];

  // 2. Insert Order Items & decrement product stock
  for (const item of data.items) {
    await query(
      `INSERT INTO shop.order_items (order_id, product_id, title, price, quantity, total)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [order.id, item.productId || null, item.title, item.price, item.quantity, item.total]
    );

    if (item.productId) {
      await query(
        `UPDATE shop.products SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
        [item.quantity, item.productId]
      );
    }
  }

  // 3. Increment voucher usage if applied
  if (data.voucherCode) {
    await query(
      `UPDATE shop.vouchers SET used_count = used_count + 1 WHERE UPPER(code) = UPPER($1)`,
      [data.voucherCode]
    );
  }

  // 4. AUTOMATED CROSS-MODULE INTEGRATION: Create Dispatch in Fleetops!
  const dispatchNumber = `DSP-${Date.now().toString().slice(-6)}`;
  await query(
    `INSERT INTO fleet.dispatches (
       dispatch_number, order_id, pickup_address, delivery_address, status, scheduled_at
     ) VALUES ($1, $2, 'Archon Nell Main Chemical Plant, Cavite Industrial Park', $3, 'Scheduled', NOW())`,
    [dispatchNumber, order.id, data.deliveryAddress]
  );

  // 5. Audit Log Registration
  try {
    let auditUserId = data.userId || null;
    if (!auditUserId) {
      const adminLookup = await query("SELECT id FROM auth_core.users WHERE global_role IN ('superadmin', 'admin') LIMIT 1");
      auditUserId = adminLookup.rows[0]?.id || null;
    }
    await query(
      `INSERT INTO auth_core.audit_logs (user_id, module, action, resource_id, details)
       VALUES ($1, 'orders', 'ORDER_CREATED', $2, $3)`,
      [
        auditUserId,
        order.order_number,
        JSON.stringify({
          order_number: order.order_number,
          customer_name: data.customerName,
          customer_email: data.customerEmail,
          total: data.total,
          payment_method: data.paymentMethod,
          items_count: data.items.length
        })
      ]
    );
  } catch (auditErr) {
    console.warn('[Audit Log Create Order Warning]:', auditErr);
  }

  return {
    ...order,
    dispatchNumber
  };
}

export async function getAllOrders(options: {
  userId?: string;
  status?: string;
  search?: string;
} = {}) {
  let sql = `
    SELECT o.*, COUNT(oi.id)::int AS total_items,
           d.dispatch_number, d.status AS dispatch_status, d.driver_id,
           dr.first_name AS driver_first_name, dr.last_name AS driver_last_name
    FROM shop.orders o
    LEFT JOIN shop.order_items oi ON oi.order_id = o.id
    LEFT JOIN fleet.dispatches d ON d.order_id = o.id
    LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
    LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (options.userId) {
    params.push(options.userId);
    sql += ` AND o.user_id = $${params.length}`;
  }
  if (options.status && options.status !== 'all') {
    params.push(options.status);
    sql += ` AND o.delivery_status = $${params.length}`;
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    sql += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.customer_email ILIKE $${params.length})`;
  }

  sql += ` GROUP BY o.id, d.dispatch_number, d.status, d.driver_id, dr.first_name, dr.last_name ORDER BY o.created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function getOrderByIdOrNumber(identifier: string) {
  const orderRes = await query(
    `SELECT o.*, d.dispatch_number, d.status AS dispatch_status,
            v.plate_number, v.model AS vehicle_model,
            dr.first_name AS driver_first_name, dr.last_name AS driver_last_name, dr.phone AS driver_phone
     FROM shop.orders o
     LEFT JOIN fleet.dispatches d ON d.order_id = o.id
     LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
     LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
     LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
     WHERE o.id = $1 OR o.order_number = $1`,
    [identifier]
  );

  if (orderRes.rows.length === 0) {
    throw { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' };
  }

  const itemsRes = await query(
    `SELECT * FROM shop.order_items WHERE order_id = $1`,
    [orderRes.rows[0].id]
  );

  return {
    ...orderRes.rows[0],
    items: itemsRes.rows
  };
}

export async function updateOrderStatus(
  orderIdentifier: string, 
  deliveryStatus: string, 
  trackingStep?: string,
  actorUserId?: string | null,
  actorDetails?: any
) {
  const orderRes = await query(
    'SELECT * FROM shop.orders WHERE id::text = $1 OR order_number = $1 LIMIT 1', 
    [orderIdentifier]
  );
  if (orderRes.rows.length === 0) {
    throw { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found.' };
  }

  const order = orderRes.rows[0];
  let steps = typeof order.tracking_steps === 'string' ? JSON.parse(order.tracking_steps) : (order.tracking_steps || []);

  const normalizedStatus = deliveryStatus.trim();
  const nowStr = new Date().toISOString();

  if (trackingStep && Array.isArray(steps)) {
    steps = steps.map((s: any) => {
      if (s.step === trackingStep) {
        return { ...s, done: true, time: nowStr };
      }
      return s;
    });
  }

  const result = await query(
    `UPDATE shop.orders
     SET delivery_status = $1,
         current_tracking_step = COALESCE($2, current_tracking_step),
         tracking_steps = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [normalizedStatus, trackingStep || normalizedStatus, JSON.stringify(steps), order.id]
  );

  const updatedOrder = result.rows[0];

  // Insert Audit Log Entry
  try {
    let auditUserId = actorUserId;
    if (!auditUserId || auditUserId === 'guest') {
      const adminLookup = await query("SELECT id FROM auth_core.users WHERE global_role IN ('superadmin', 'admin') LIMIT 1");
      auditUserId = adminLookup.rows[0]?.id || null;
    }

    await query(
      `INSERT INTO auth_core.audit_logs (user_id, module, action, resource_id, details)
       VALUES ($1, 'orders', 'ORDER_STATUS_UPDATED', $2, $3)`,
      [
        auditUserId,
        order.order_number || order.id,
        JSON.stringify({
          order_id: order.id,
          order_number: order.order_number,
          previous_status: order.delivery_status,
          new_status: normalizedStatus,
          customer_name: order.customer_name,
          total: order.total,
          updated_by: actorDetails?.name || 'Admin',
          notes: actorDetails?.notes || null,
          timestamp: nowStr
        })
      ]
    );
  } catch (auditErr) {
    console.warn('[Audit Log Error on Order Status Update]:', auditErr);
  }

  return updatedOrder;
}

// ------------------------------------------------------------------------------
// REVIEWS
// ------------------------------------------------------------------------------

export async function getProductReviews(productId: string) {
  const result = await query(
    `SELECT * FROM shop.reviews WHERE product_id = $1 ORDER BY created_at DESC`,
    [productId]
  );
  return result.rows;
}

export async function createProductReview(data: {
  productId: string;
  userId?: string;
  customerName: string;
  rating: number;
  comment?: string;
  aiSentiment?: string;
}) {
  const result = await query(
    `INSERT INTO shop.reviews (
       product_id, user_id, customer_name, rating, comment, ai_sentiment, is_verified_purchase
     ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING *`,
    [
      data.productId,
      data.userId || null,
      data.customerName,
      data.rating,
      data.comment || null,
      data.aiSentiment || 'POSITIVE'
    ]
  );
  return result.rows[0];
}
