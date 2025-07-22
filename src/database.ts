import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';

const databaseUrl = process.env.DATABASE_URL!;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable. Please check your MCP server configuration.');
}

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper function to execute queries
async function query(text: string, params?: any[]): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Function to verify database connection and ensure business exists
export async function ensureBusinessExists(business_id: string): Promise<void> {
  try {
    // Check if business exists
    const result = await query(
      'SELECT * FROM businesses WHERE id = $1',
      [business_id]
    );

    // If business doesn't exist, create it
    if (result.rows.length === 0) {
      await query(
        'INSERT INTO businesses (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [business_id, `Business ${business_id}`, new Date().toISOString(), new Date().toISOString()]
      );
      console.log(`Created business with ID: ${business_id}`);
    } else {
      console.log(`Business exists with ID: ${business_id}`);
    }
  } catch (error) {
    console.error('Error ensuring business exists:', error);
    throw error;
  }
}

// Helper function to generate UUID
export function generateUUID(): string {
  return randomUUID();
}

// Helper function to validate UUID format
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export async function getBusinessDetails(business_id: string) {
  try {
    const result = await query(
      'SELECT * FROM businesses WHERE id = $1',
      [business_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Business not found: ${business_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to get business details: ${error.message}`);
  }
}

// Customer management functions
export async function createCustomer(business_id: string, customerData: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  notes?: string;
}) {
  try {
    const result = await query(
      `INSERT INTO customers (business_id, first_name, last_name, email, phone_number, notes, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   RETURNING *`,
      [
        business_id,
        customerData.first_name,
        customerData.last_name,
        customerData.email,
        customerData.phone || null,
        customerData.notes || null,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to create customer: ${error.message}`);
  }
}

export async function getCustomer(business_id: string, customer_id: string) {
  try {
    const result = await query(
      'SELECT * FROM customers WHERE id = $1 AND business_id = $2',
      [customer_id, business_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Customer not found: ${customer_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to get customer: ${error.message}`);
  }
}

export async function searchCustomers(business_id: string, searchTerm: string) {
  try {
    const result = await query(
      `SELECT * FROM customers 
       WHERE business_id = $1 
       AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2 OR phone_number ILIKE $2)
       ORDER BY created_at DESC`,
      [business_id, `%${searchTerm}%`]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to search customers: ${error.message}`);
  }
}

export async function updateCustomer(business_id: string, customer_id: string, updates: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  notes?: string;
}) {
  try {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        // Map phone to phone_number for database compatibility
        const dbKey = key === 'phone' ? 'phone_number' : key;
        setClause.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid updates provided');
    }

    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date().toISOString());
    paramIndex++;

    // Add customer_id and business_id for WHERE clause
    const customerIdParam = paramIndex;
    const businessIdParam = paramIndex + 1;
    values.push(customer_id, business_id);

    const result = await query(
      `UPDATE customers SET ${setClause.join(', ')} 
       WHERE id = $${customerIdParam} AND business_id = $${businessIdParam}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Customer not found: ${customer_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to update customer: ${error.message}`);
  }
}

// Service inquiry functions
export async function getServices(business_id: string) {
  try {
    const result = await query(
      `SELECT s.*, sc.name as category_name, sc.description as category_description
       FROM services s
       LEFT JOIN service_categories sc ON s.category_id = sc.id
       WHERE s.business_id = $1 AND s.is_active = true
       ORDER BY s.name`,
      [business_id]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get services: ${error.message}`);
  }
}

export async function getService(business_id: string, service_id: string) {
  try {
    const result = await query(
      `SELECT s.*, sc.name as category_name, sc.description as category_description
       FROM services s
       LEFT JOIN service_categories sc ON s.category_id = sc.id
       WHERE s.id = $1 AND s.business_id = $2`,
      [service_id, business_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Service not found: ${service_id}`);
    }

    const service = result.rows[0];

    // Get staff for this service
    const staffResult = await query(
      `SELECT st.first_name, st.last_name, st.bio, st.avatar_url
       FROM staff st
       JOIN staff_services ss ON st.id = ss.staff_id
       WHERE ss.service_id = $1 AND st.business_id = $2`,
      [service_id, business_id]
    );

    service.staff = staffResult.rows;

    return service;
  } catch (error: any) {
    throw new Error(`Failed to get service: ${error.message}`);
  }
}

// Customer appointment history
export async function getCustomerAppointments(business_id: string, customer_id: string, limit?: number) {
  try {
    let queryText = `
      SELECT a.*, 
             s.name as service_name, s.duration_minutes, s.price_cents,
             st.first_name as staff_first_name, st.last_name as staff_last_name,
             r.rating, r.review_text
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN staff st ON a.staff_id = st.id
      LEFT JOIN reviews r ON a.id = r.appointment_id
      WHERE a.business_id = $1 AND a.customer_id = $2
      ORDER BY a.start_time DESC
    `;

    const params = [business_id, customer_id];

    if (limit) {
      queryText += ` LIMIT $3`;
      params.push(limit.toString());
    }

    const result = await query(queryText, params);
    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get customer appointments: ${error.message}`);
  }
}

// Business hours and availability
export async function getBusinessHours(business_id: string) {
  try {
    const result = await query(
      'SELECT * FROM working_hours WHERE business_id = $1 ORDER BY day_of_week',
      [business_id]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get business hours: ${error.message}`);
  }
}

// Staff information
export async function getStaff(business_id: string) {
  try {
    const result = await query(
      `SELECT st.*,
              json_agg(
                json_build_object(
                  'name', s.name,
                  'description', s.description
                )
              ) FILTER (WHERE s.id IS NOT NULL) as services
       FROM staff st
       LEFT JOIN staff_services ss ON st.id = ss.staff_id
       LEFT JOIN services s ON ss.service_id = s.id
       WHERE st.business_id = $1 AND st.is_active = true
       GROUP BY st.id
       ORDER BY st.first_name`,
      [business_id]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get staff: ${error.message}`);
  }
}

// Customer reviews
export async function getCustomerReviews(business_id: string, customer_id: string) {
  try {
    const result = await query(
      `SELECT r.*,
              a.start_time,
              s.name as service_name,
              st.first_name as staff_first_name, st.last_name as staff_last_name
       FROM reviews r
       LEFT JOIN appointments a ON r.appointment_id = a.id
       LEFT JOIN services s ON r.service_id = s.id
       LEFT JOIN staff st ON r.staff_id = st.id
       WHERE r.business_id = $1 AND r.customer_id = $2
       ORDER BY r.created_at DESC`,
      [business_id, customer_id]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get customer reviews: ${error.message}`);
  }
}

export async function createReview(business_id: string, reviewData: {
  appointment_id: string;
  customer_id: string;
  service_id: string;
  staff_id?: string;
  rating: number;
  review_text?: string;
}) {
  try {
    const result = await query(
      `INSERT INTO reviews (business_id, appointment_id, customer_id, service_id, staff_id, rating, review_text, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        business_id,
        reviewData.appointment_id,
        reviewData.customer_id,
        reviewData.service_id,
        reviewData.staff_id || null,
        reviewData.rating,
        reviewData.review_text || null,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to create review: ${error.message}`);
  }
}

// Appointment management functions
export async function createAppointment(business_id: string, appointmentData: {
  customer_id: string;
  service_id: string;
  staff_id?: string;
  start_time: string;
  end_time: string;
  notes?: string;
}) {
  try {
    const result = await query(
      `INSERT INTO appointments (business_id, customer_id, service_id, staff_id, start_time, end_time, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        business_id,
        appointmentData.customer_id,
        appointmentData.service_id,
        appointmentData.staff_id || null,
        appointmentData.start_time,
        appointmentData.end_time,
        'scheduled',
        appointmentData.notes || null,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to create appointment: ${error.message}`);
  }
}

export async function getAppointments(business_id: string, filters?: {
  customer_id?: string;
  service_id?: string;
  staff_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}) {
  try {
    let whereClause = 'WHERE a.business_id = $1';
    const params = [business_id];
    let paramIndex = 2;

    if (filters?.customer_id) {
      whereClause += ` AND a.customer_id = $${paramIndex}`;
      params.push(filters.customer_id);
      paramIndex++;
    }
    if (filters?.service_id) {
      whereClause += ` AND a.service_id = $${paramIndex}`;
      params.push(filters.service_id);
      paramIndex++;
    }
    if (filters?.staff_id) {
      whereClause += ` AND a.staff_id = $${paramIndex}`;
      params.push(filters.staff_id);
      paramIndex++;
    }
    if (filters?.status) {
      whereClause += ` AND a.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.start_date) {
      whereClause += ` AND a.start_time >= $${paramIndex}`;
      params.push(filters.start_date);
      paramIndex++;
    }
    if (filters?.end_date) {
      whereClause += ` AND a.start_time <= $${paramIndex}`;
      params.push(filters.end_date);
      paramIndex++;
    }

    const result = await query(
      `SELECT a.*,
              c.first_name as customer_first_name, c.last_name as customer_last_name, c.email as customer_email,
              s.name as service_name, s.duration_minutes, s.price_cents,
              st.first_name as staff_first_name, st.last_name as staff_last_name
       FROM appointments a
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN services s ON a.service_id = s.id
       LEFT JOIN staff st ON a.staff_id = st.id
       ${whereClause}
       ORDER BY a.start_time ASC`,
      params
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get appointments: ${error.message}`);
  }
}

export async function getAppointment(business_id: string, appointment_id: string) {
  try {
    const result = await query(
      `SELECT a.*,
              c.first_name as customer_first_name, c.last_name as customer_last_name, c.email as customer_email, c.phone_number as customer_phone,
              s.name as service_name, s.description as service_description, s.duration_minutes, s.price_cents,
              st.first_name as staff_first_name, st.last_name as staff_last_name, st.email as staff_email
       FROM appointments a
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN services s ON a.service_id = s.id
       LEFT JOIN staff st ON a.staff_id = st.id
       WHERE a.id = $1 AND a.business_id = $2`,
      [appointment_id, business_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Appointment not found: ${appointment_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to get appointment: ${error.message}`);
  }
}

export async function deleteAppointment(business_id: string, appointment_id: string) {
  try {
    const result = await query(
      'DELETE FROM appointments WHERE id = $1 AND business_id = $2 RETURNING *',
      [appointment_id, business_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Appointment not found: ${appointment_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to delete appointment: ${error.message}`);
  }
}

// Database connection verification
export async function verifyDatabaseConnection(): Promise<void> {
  try {
    const result = await query('SELECT COUNT(*) FROM businesses LIMIT 1');
    console.log('Database connection verified');
  } catch (error) {
    console.error('Error verifying database connection:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});