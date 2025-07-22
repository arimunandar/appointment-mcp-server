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
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone: string;
  notes?: string | null;
}) {
  try {
    const result = await query(
      `INSERT INTO customers (business_id, first_name, last_name, email, phone_number, notes, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   RETURNING *`,
      [
        business_id,
        customerData.first_name || null,
        customerData.last_name || null,
        customerData.email || null,
        customerData.phone,
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

// Availability and Staff Management Functions

/**
 * Get staff availability for a specific date
 */
export async function getStaffAvailability(business_id: string, date: string) {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    const result = await query(
      `SELECT 
        s.id as staff_id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone_number,
        s.avatar_url,
        s.bio,
        s.is_active,
        swh.day_of_week,
        swh.open_time,
        swh.close_time,
        swh.is_available,
        -- Check if staff has time off on this date
        CASE 
          WHEN sto.date = $2::date THEN true
          ELSE false
        END as has_time_off,
        sto.title as time_off_title,
        sto.description as time_off_description,
        sto.is_all_day as time_off_all_day,
        sto.start_time as time_off_start,
        sto.end_time as time_off_end
      FROM staff s
      LEFT JOIN staff_working_hours swh ON s.id = swh.staff_id 
        AND swh.day_of_week = $3
      LEFT JOIN staff_time_off sto ON s.id = sto.staff_id 
        AND sto.date = $2::date
      WHERE s.business_id = $1
        AND s.is_active = true
      ORDER BY s.first_name, s.last_name`,
      [business_id, date, dayOfWeek]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get staff availability: ${error.message}`);
  }
}

/**
 * Get available time slots for a specific service and date
 */
export async function getAvailableTimeSlots(business_id: string, service_id: string, date: string) {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    // First get the service details
    const serviceResult = await query(
      'SELECT id, name, duration_minutes, buffer_time_minutes, max_bookings_per_slot FROM services WHERE id = $1 AND business_id = $2',
      [service_id, business_id]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error(`Service not found: ${service_id}`);
    }

    const service = serviceResult.rows[0];

    // Get staff who provide this service and their working hours
    const staffResult = await query(
      `SELECT 
        s.id as staff_id,
        s.first_name,
        s.last_name,
        swh.open_time,
        swh.close_time,
        swh.is_available
      FROM staff s
      JOIN staff_working_hours swh ON s.id = swh.staff_id 
        AND swh.day_of_week = $3
      JOIN staff_services ss ON s.id = ss.staff_id AND ss.service_id = $2
      WHERE s.business_id = $1
        AND s.is_active = true
        AND swh.is_available = true`,
      [business_id, service_id, dayOfWeek]
    );

    // Get existing appointments for this date
    const appointmentsResult = await query(
      `SELECT staff_id, COUNT(*) as appointment_count
       FROM appointments
       WHERE business_id = $1 
         AND service_id = $2
         AND DATE(start_time) = $3::date
         AND status IN ('confirmed', 'pending')
       GROUP BY staff_id`,
      [business_id, service_id, date]
    );

    const appointmentCounts = new Map();
    appointmentsResult.rows.forEach((row: any) => {
      appointmentCounts.set(row.staff_id, parseInt(row.appointment_count));
    });

    // Generate time slots for each staff member
    const timeSlots: any[] = [];
    
    for (const staff of staffResult.rows) {
      const existingAppointments = appointmentCounts.get(staff.staff_id) || 0;
      
      // Generate 30-minute slots
      const startTime = new Date(`2000-01-01T${staff.open_time}`);
      const endTime = new Date(`2000-01-01T${staff.close_time}`);
      const slotDuration = service.duration_minutes + service.buffer_time_minutes;
      
      let currentTime = new Date(startTime);
      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + service.duration_minutes * 60000);
        
        if (slotEnd <= endTime) {
          timeSlots.push({
            staff_id: staff.staff_id,
            first_name: staff.first_name,
            last_name: staff.last_name,
            service_id: service_id,
            service_name: service.name,
            duration_minutes: service.duration_minutes,
            slot_start_time: currentTime.toTimeString().slice(0, 8),
            slot_end_time: slotEnd.toTimeString().slice(0, 8),
            existing_appointments: existingAppointments,
            max_bookings_per_slot: service.max_bookings_per_slot,
            availability_status: existingAppointments < service.max_bookings_per_slot ? 'available' : 'fully_booked'
          });
        }
        
        currentTime = new Date(currentTime.getTime() + 30 * 60000); // Add 30 minutes
      }
    }

    return timeSlots;
  } catch (error: any) {
    throw new Error(`Failed to get available time slots: ${error.message}`);
  }
}

/**
 * Get all staff information with their services and working hours
 */
export async function getAllStaffInfo(business_id: string) {
  try {
    const result = await query(
      `SELECT 
        s.id as staff_id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone_number,
        s.avatar_url,
        s.bio,
        s.is_active,
        -- Get services this staff member provides
        STRING_AGG(DISTINCT sv.name, ', ' ORDER BY sv.name) as services_provided,
        COUNT(DISTINCT ss.service_id) as total_services,
        -- Get working hours summary
        STRING_AGG(
          DISTINCT 
          CASE swh.day_of_week
            WHEN 0 THEN 'Monday'
            WHEN 1 THEN 'Tuesday' 
            WHEN 2 THEN 'Wednesday'
            WHEN 3 THEN 'Thursday'
            WHEN 4 THEN 'Friday'
            WHEN 5 THEN 'Saturday'
            WHEN 6 THEN 'Sunday'
          END || ': ' || swh.open_time || '-' || swh.close_time,
          '; '
        ) as working_hours_summary,
        -- Get upcoming appointments count
        COUNT(DISTINCT CASE WHEN a.status IN ('confirmed', 'pending') AND a.start_time > NOW() THEN a.id END) as upcoming_appointments,
        -- Get completed appointments count
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_appointments
      FROM staff s
      LEFT JOIN staff_services ss ON s.id = ss.staff_id
      LEFT JOIN services sv ON ss.service_id = sv.id
      LEFT JOIN staff_working_hours swh ON s.id = swh.staff_id AND swh.is_available = true
      LEFT JOIN appointments a ON s.id = a.staff_id
      WHERE s.business_id = $1
      GROUP BY s.id, s.first_name, s.last_name, s.email, s.phone_number, s.avatar_url, s.bio, s.is_active
      ORDER BY s.first_name, s.last_name`,
      [business_id]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get staff information: ${error.message}`);
  }
}

/**
 * Get staff member by ID with detailed information
 */
export async function getStaffMember(business_id: string, staff_id: string) {
  try {
    const result = await query(
      `SELECT 
        s.id as staff_id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone_number,
        s.avatar_url,
        s.bio,
        s.is_active,
        -- Get services this staff member provides
        json_agg(
          DISTINCT jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'description', sv.description,
            'duration_minutes', sv.duration_minutes,
            'price_cents', sv.price_cents
          )
        ) FILTER (WHERE sv.id IS NOT NULL) as services,
        -- Get working hours
        json_agg(
          DISTINCT jsonb_build_object(
            'day_of_week', swh.day_of_week,
            'day_name', CASE swh.day_of_week
              WHEN 0 THEN 'Monday'
              WHEN 1 THEN 'Tuesday' 
              WHEN 2 THEN 'Wednesday'
              WHEN 3 THEN 'Thursday'
              WHEN 4 THEN 'Friday'
              WHEN 5 THEN 'Saturday'
              WHEN 6 THEN 'Sunday'
            END,
            'open_time', swh.open_time,
            'close_time', swh.close_time,
            'is_available', swh.is_available
          )
        ) FILTER (WHERE swh.id IS NOT NULL) as working_hours,
        -- Get upcoming appointments
        COUNT(DISTINCT CASE WHEN a.status IN ('confirmed', 'pending') AND a.start_time > NOW() THEN a.id END) as upcoming_appointments,
        -- Get completed appointments count
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_appointments
      FROM staff s
      LEFT JOIN staff_services ss ON s.id = ss.staff_id
      LEFT JOIN services sv ON ss.service_id = sv.id
      LEFT JOIN staff_working_hours swh ON s.id = swh.staff_id
      LEFT JOIN appointments a ON s.id = a.staff_id
      WHERE s.business_id = $1 AND s.id = $2
      GROUP BY s.id, s.first_name, s.last_name, s.email, s.phone_number, s.avatar_url, s.bio, s.is_active`,
      [business_id, staff_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Staff member not found: ${staff_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to get staff member: ${error.message}`);
  }
}

/**
 * Get staff time off for a specific date range
 */
export async function getStaffTimeOff(business_id: string, start_date?: string, end_date?: string) {
  try {
    let whereClause = 'WHERE sto.business_id = $1';
    const params = [business_id];
    let paramIndex = 2;

    if (start_date) {
      whereClause += ` AND sto.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      whereClause += ` AND sto.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        sto.id,
        sto.staff_id,
        s.first_name,
        s.last_name,
        sto.title,
        sto.description,
        sto.date,
        sto.start_time,
        sto.end_time,
        sto.is_all_day,
        sto.created_at
      FROM staff_time_off sto
      JOIN staff s ON sto.staff_id = s.id
      ${whereClause}
      ORDER BY sto.date ASC, sto.start_time ASC`,
      params
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get staff time off: ${error.message}`);
  }
}

/**
 * Check if a service is available on a specific date and time
 */
export async function checkServiceAvailability(business_id: string, service_name: string, date: string, time?: string) {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    // First, find the service by name
    const serviceResult = await query(
      'SELECT id, name, duration_minutes, buffer_time_minutes, max_bookings_per_slot FROM services WHERE LOWER(name) LIKE LOWER($1) AND business_id = $2 AND is_active = true',
      [`%${service_name}%`, business_id]
    );

    if (serviceResult.rows.length === 0) {
      return {
        available: false,
        reason: `Service "${service_name}" not found or not active`,
        service: null,
        staff: []
      };
    }

    const service = serviceResult.rows[0];

    // Get staff who provide this service and are available on this day
    const staffResult = await query(
      `SELECT 
        s.id as staff_id,
        s.first_name,
        s.last_name,
        s.email,
        swh.open_time,
        swh.close_time,
        swh.is_available,
        -- Check if staff has time off on this date
        CASE 
          WHEN sto.date = $3::date THEN true
          ELSE false
        END as has_time_off,
        sto.title as time_off_title,
        sto.is_all_day as time_off_all_day
      FROM staff s
      JOIN staff_services ss ON s.id = ss.staff_id AND ss.service_id = $2
      LEFT JOIN staff_working_hours swh ON s.id = swh.staff_id 
        AND swh.day_of_week = $4
      LEFT JOIN staff_time_off sto ON s.id = sto.staff_id 
        AND sto.date = $3::date
      WHERE s.business_id = $1
        AND s.is_active = true
        AND swh.is_available = true
        AND (sto.id IS NULL OR sto.is_all_day = false)
      ORDER BY s.first_name, s.last_name`,
      [business_id, service.id, date, dayOfWeek]
    );

    if (staffResult.rows.length === 0) {
      return {
        available: false,
        reason: `No staff available for ${service.name} on ${date}`,
        service: service,
        staff: []
      };
    }

    // If specific time is requested, check if it's within working hours
    let availableStaff = staffResult.rows;
    if (time) {
      availableStaff = staffResult.rows.filter((staff: any) => {
        if (staff.has_time_off) return false;
        if (!staff.open_time || !staff.close_time) return false;
        
        const requestedTime = new Date(`2000-01-01T${time}`);
        const openTime = new Date(`2000-01-01T${staff.open_time}`);
        const closeTime = new Date(`2000-01-01T${staff.close_time}`);
        
        return requestedTime >= openTime && requestedTime < closeTime;
      });

      if (availableStaff.length === 0) {
        return {
          available: false,
          reason: `No staff available for ${service.name} at ${time} on ${date}`,
          service: service,
          staff: staffResult.rows
        };
      }
    }

    // Check existing appointments for this service and date at the specific time slot
    let appointmentsQuery = '';
    let appointmentParams = [business_id, service.id, date];
    
    if (time) {
      // If specific time is requested, check appointments that overlap with the requested time slot
      const requestedTime = new Date(`2000-01-01T${time}`);
      const slotEndTime = new Date(requestedTime.getTime() + service.duration_minutes * 60000);
      
      appointmentsQuery = `
        SELECT COUNT(*) as appointment_count
        FROM appointments
        WHERE business_id = $1 
          AND service_id = $2
          AND DATE(start_time) = $3::date
          AND status IN ('confirmed', 'pending', 'scheduled')
          AND (
            (start_time::time >= $4::time AND start_time::time < $5::time) OR
            (end_time::time > $4::time AND end_time::time <= $5::time) OR
            (start_time::time <= $4::time AND end_time::time >= $5::time)
          )`;
      appointmentParams.push(time, slotEndTime.toTimeString().slice(0, 8));
    } else {
      // If no specific time, check total appointments for the day
      appointmentsQuery = `
        SELECT COUNT(*) as appointment_count
        FROM appointments
        WHERE business_id = $1 
          AND service_id = $2
          AND DATE(start_time) = $3::date
          AND status IN ('confirmed', 'pending', 'scheduled')`;
    }

    const appointmentsResult = await query(appointmentsQuery, appointmentParams);
    const existingAppointments = parseInt(appointmentsResult.rows[0].appointment_count);

    // Check if the service has reached its booking capacity
    if (existingAppointments >= service.max_bookings_per_slot) {
      return {
        available: false,
        reason: `${service.name} is fully booked on ${date}${time ? ` at ${time}` : ''} (${existingAppointments}/${service.max_bookings_per_slot} slots taken)`,
        service: service,
        staff: availableStaff,
        existingAppointments: existingAppointments,
        maxBookings: service.max_bookings_per_slot
      };
    }

    return {
      available: true,
      reason: `${service.name} is available on ${date}${time ? ` at ${time}` : ''} (${service.max_bookings_per_slot - existingAppointments} slots remaining)`,
      service: service,
      staff: availableStaff,
      existingAppointments: existingAppointments,
      maxBookings: service.max_bookings_per_slot,
      remainingSlots: service.max_bookings_per_slot - existingAppointments
    };
  } catch (error: any) {
    throw new Error(`Failed to check service availability: ${error.message}`);
  }
}

/**
 * Get available time slots for a service on a specific date
 */
export async function getServiceTimeSlots(business_id: string, service_name: string, date: string) {
  try {
    const availability = await checkServiceAvailability(business_id, service_name, date);
    
    if (!availability.available) {
      return {
        available: false,
        reason: availability.reason,
        timeSlots: []
      };
    }

    const service = availability.service;
    const availableStaff = availability.staff;
    const timeSlots: any[] = [];

    // Generate time slots for each available staff member
    for (const staff of availableStaff) {
      if (!staff.open_time || !staff.close_time) continue;

      const startTime = new Date(`2000-01-01T${staff.open_time}`);
      const endTime = new Date(`2000-01-01T${staff.close_time}`);
      const slotDuration = service.duration_minutes + service.buffer_time_minutes;

      let currentTime = new Date(startTime);
      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + service.duration_minutes * 60000);
        
        if (slotEnd <= endTime) {
          const slotStartTime = currentTime.toTimeString().slice(0, 8);
          const slotEndTime = slotEnd.toTimeString().slice(0, 8);
          
          // Check if this specific time slot has availability
          const slotAvailability = await checkServiceAvailability(business_id, service_name, date, slotStartTime);
          
          if (slotAvailability.available) {
            timeSlots.push({
              staff_id: staff.staff_id,
              staff_name: `${staff.first_name} ${staff.last_name}`,
              service_id: service.id,
              service_name: service.name,
              duration_minutes: service.duration_minutes,
              start_time: slotStartTime,
              end_time: slotEndTime,
              date: date,
              remaining_slots: slotAvailability.remainingSlots,
              total_slots: slotAvailability.maxBookings,
              existing_appointments: slotAvailability.existingAppointments
            });
          }
        }
        
        currentTime = new Date(currentTime.getTime() + 30 * 60000); // Add 30 minutes
      }
    }

    return {
      available: timeSlots.length > 0,
      reason: timeSlots.length > 0 
        ? `${service.name} has ${timeSlots.length} available time slots on ${date}` 
        : `${service.name} is fully booked on ${date}`,
      timeSlots: timeSlots,
      service: service
    };
  } catch (error: any) {
    throw new Error(`Failed to get service time slots: ${error.message}`);
  }
}

/**
 * Check business hours for a specific date
 */
export async function checkBusinessHours(business_id: string, date: string) {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    const result = await query(
      `SELECT 
        day_of_week,
        open_time,
        close_time,
        is_closed
      FROM working_hours
      WHERE business_id = $1 AND day_of_week = $2`,
      [business_id, dayOfWeek]
    );

    if (result.rows.length === 0) {
      return {
        isOpen: false,
        reason: `No business hours set for this day`,
        hours: null
      };
    }

    const hours = result.rows[0];
    
    if (hours.is_closed) {
      return {
        isOpen: false,
        reason: `Business is closed on ${date}`,
        hours: hours
      };
    }

    return {
      isOpen: true,
      reason: `Business is open from ${hours.open_time} to ${hours.close_time} on ${date}`,
      hours: hours
    };
  } catch (error: any) {
    throw new Error(`Failed to check business hours: ${error.message}`);
  }
}