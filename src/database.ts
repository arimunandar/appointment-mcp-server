import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';

const databaseUrl = process.env.DATABASE_URL!;
const BUSINESS_ID = process.env.BUSINESS_ID!;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable. Please check your MCP server configuration.');
}

if (!BUSINESS_ID) {
  throw new Error('Missing BUSINESS_ID environment variable. Please check your MCP server configuration.');
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
export async function ensureBusinessExists(): Promise<void> {
  try {
    // Check if business exists
    const result = await query(
      'SELECT * FROM businesses WHERE id = $1',
      [BUSINESS_ID]
    );

    // If business doesn't exist, create it
    if (result.rows.length === 0) {
      await query(
        'INSERT INTO businesses (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [BUSINESS_ID, `Business ${BUSINESS_ID}`, new Date().toISOString(), new Date().toISOString()]
      );
      console.log(`Created business with ID: ${BUSINESS_ID}`);
    } else {
      console.log(`Business exists with ID: ${BUSINESS_ID}`);
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

export async function getBusinessDetails() {
  try {
    const result = await query(
      'SELECT * FROM businesses WHERE id = $1',
      [BUSINESS_ID]
    );

    if (result.rows.length === 0) {
      throw new Error(`Business not found: ${BUSINESS_ID}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to get business details: ${error.message}`);
  }
}

// Customer management functions
export async function createCustomer(customerData: {
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
        BUSINESS_ID,
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

export async function getCustomer(customer_id: string) {
  try {
    const result = await query(
      'SELECT * FROM customers WHERE id = $1 AND business_id = $2',
      [customer_id, BUSINESS_ID]
    );

    if (result.rows.length === 0) {
      throw new Error(`Customer not found: ${customer_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to get customer: ${error.message}`);
  }
}

export async function searchCustomers(searchTerm: string) {
  try {
    const result = await query(
      `SELECT * FROM customers 
       WHERE business_id = $1 
       AND (
         first_name ILIKE $2 
         OR last_name ILIKE $2 
         OR email ILIKE $2 
         OR phone_number ILIKE $2
       )
       ORDER BY created_at DESC`,
      [BUSINESS_ID, `%${searchTerm}%`]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to search customers: ${error.message}`);
  }
}

export async function updateCustomer(customer_id: string, updates: {
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
    values.push(customer_id, BUSINESS_ID);

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
export async function getServices() {
  try {
    const result = await query(
      `SELECT s.*, sc.name as category_name, sc.description as category_description
       FROM services s
       LEFT JOIN service_categories sc ON s.category_id = sc.id
       WHERE s.business_id = $1 AND s.is_active = true
       ORDER BY s.name`,
      [BUSINESS_ID]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get services: ${error.message}`);
  }
}

export async function getService(service_id: string) {
  try {
    const result = await query(
      `SELECT s.*, sc.name as category_name, sc.description as category_description
       FROM services s
       LEFT JOIN service_categories sc ON s.category_id = sc.id
       WHERE s.id = $1 AND s.business_id = $2`,
      [service_id, BUSINESS_ID]
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
      [service_id, BUSINESS_ID]
    );

    service.staff = staffResult.rows;

    return service;
  } catch (error: any) {
    throw new Error(`Failed to get service: ${error.message}`);
  }
}

export async function getServiceByName(service_name: string) {
  try {
    const result = await query(
      `SELECT s.*, sc.name as category_name, sc.description as category_description
       FROM services s
       LEFT JOIN service_categories sc ON s.category_id = sc.id
       WHERE LOWER(s.name) LIKE LOWER($1) AND s.business_id = $2 AND s.is_active = true
       ORDER BY s.name`,
      [`%${service_name}%`, BUSINESS_ID]
    );

    if (result.rows.length === 0) {
      throw new Error(`No services found matching: ${service_name}`);
    }

    // For each service, get staff information
    const servicesWithStaff = await Promise.all(
      result.rows.map(async (service: any) => {
        const staffResult = await query(
          `SELECT st.first_name, st.last_name, st.bio, st.avatar_url, st.email, st.phone_number
           FROM staff st
           JOIN staff_services ss ON st.id = ss.staff_id
           WHERE ss.service_id = $1 AND st.business_id = $2 AND st.is_active = true
           ORDER BY st.first_name, st.last_name`,
          [service.id, BUSINESS_ID]
        );

        return {
          ...service,
          staff: staffResult.rows,
          staff_count: staffResult.rows.length
        };
      })
    );

    return servicesWithStaff;
  } catch (error: any) {
    throw new Error(`Failed to get service by name: ${error.message}`);
  }
}

export async function searchServicesFuzzy(service_name: string, similarity_threshold: number = 0.3) {
  try {
    const result = await query(
      `SELECT * FROM search_services_fuzzy($1, $2)`,
      [service_name, similarity_threshold]
    );

    if (!result.rows[0] || !result.rows[0].search_services_fuzzy) {
      return [];
    }

    return result.rows[0].search_services_fuzzy;
  } catch (error: any) {
    throw new Error(`Failed to search services with fuzzy matching: ${error.message}`);
  }
}

export async function searchServicesComprehensive(search_term: string, similarity_threshold: number = 0.3) {
  try {
    const result = await query(
      `SELECT * FROM search_services_comprehensive($1, $2)`,
      [search_term, similarity_threshold]
    );

    if (!result.rows[0] || !result.rows[0].search_services_comprehensive) {
      return [];
    }

    return result.rows[0].search_services_comprehensive;
  } catch (error: any) {
    throw new Error(`Failed to search services comprehensively: ${error.message}`);
  }
}

// Customer appointment history
export async function getCustomerAppointments(customer_id: string, limit?: number) {
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

    const params = [BUSINESS_ID, customer_id];

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
export async function getBusinessHours() {
  try {
    const result = await query(
      'SELECT * FROM get_business_hours($1)',
      [BUSINESS_ID]
    );

    return result.rows[0].get_business_hours;
  } catch (error: any) {
    throw new Error(`Failed to get business hours: ${error.message}`);
  }
}

// Staff information
export async function getStaff() {
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
      [BUSINESS_ID]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get staff: ${error.message}`);
  }
}

// Customer reviews
export async function getCustomerReviews(customer_id: string) {
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
      [BUSINESS_ID, customer_id]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get customer reviews: ${error.message}`);
  }
}

export async function createReview(reviewData: {
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
        BUSINESS_ID,
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
export async function createAppointment(appointmentData: {
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
        BUSINESS_ID,
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

export async function getAppointments(filters?: {
  customer_id?: string;
  service_id?: string;
  staff_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}) {
  try {
    let whereClause = 'WHERE a.business_id = $1';
    const params = [BUSINESS_ID];
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

export async function getAppointment(appointment_id: string) {
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
      [appointment_id, BUSINESS_ID]
    );

    if (result.rows.length === 0) {
      throw new Error(`Appointment not found: ${appointment_id}`);
    }

    return result.rows[0];
  } catch (error: any) {
    throw new Error(`Failed to get appointment: ${error.message}`);
  }
}

export async function deleteAppointment(appointment_id: string) {
  try {
    const result = await query(
      'DELETE FROM appointments WHERE id = $1 AND business_id = $2 RETURNING *',
      [appointment_id, BUSINESS_ID]
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
export async function getStaffAvailability(date: string) {
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
      [BUSINESS_ID, date, dayOfWeek]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get staff availability: ${error.message}`);
  }
}

/**
 * Get available time slots for a specific service and date
 */
export async function getAvailableTimeSlots(service_id: string, date: string) {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    // First get the service details
    const serviceResult = await query(
      'SELECT id, name, duration_minutes, buffer_time_minutes, max_bookings_per_slot FROM services WHERE id = $1 AND business_id = $2',
      [service_id, BUSINESS_ID]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error(`Service not found: ${service_id}`);
    }

    const service = serviceResult.rows[0];
    const serviceDuration = service.duration_minutes;
    const bufferTime = service.buffer_time_minutes || 0;
    const maxBookingsPerSlot = service.max_bookings_per_slot || 1;

    // Get business hours for this day
    const businessHoursResult = await query(
      'SELECT open_time, close_time FROM working_hours WHERE business_id = $1 AND day_of_week = $2 AND is_open = true',
      [BUSINESS_ID, dayOfWeek]
    );

    if (businessHoursResult.rows.length === 0) {
      return []; // Business is closed on this day
    }

    const businessHours = businessHoursResult.rows[0];
    const openTime = businessHours.open_time;
    const closeTime = businessHours.close_time;

    // Get staff who can provide this service
    const staffResult = await query(
      `SELECT DISTINCT s.id, s.first_name, s.last_name
       FROM staff s
       JOIN staff_services ss ON s.id = ss.staff_id
       WHERE ss.service_id = $1 AND s.business_id = $2 AND s.is_active = true`,
      [service_id, BUSINESS_ID]
    );

    if (staffResult.rows.length === 0) {
      return []; // No staff available for this service
    }

    // Get existing appointments for this date
    const appointmentsResult = await query(
      `SELECT staff_id, start_time, end_time
       FROM appointments
       WHERE business_id = $1 AND service_id = $2 AND DATE(start_time) = $3 AND status != 'cancelled'
       ORDER BY start_time`,
      [BUSINESS_ID, service_id, date]
    );

    const existingAppointments = appointmentsResult.rows;

    // Generate time slots
    const timeSlots = [];
    const slotInterval = 30; // 30-minute intervals
    
    // Convert time strings to minutes for easier calculation
    const openMinutes = timeToMinutes(openTime);
    const closeMinutes = timeToMinutes(closeTime);
    
    for (let currentMinutes = openMinutes; currentMinutes + serviceDuration <= closeMinutes; currentMinutes += slotInterval) {
      const slotStartTime = minutesToTime(currentMinutes);
      const slotEndTime = minutesToTime(currentMinutes + serviceDuration);
      
      // Check availability for each staff member
      const availableStaff = [];
      
      for (const staff of staffResult.rows) {
        const isStaffAvailable = !existingAppointments.some((appointment: any) => {
          if (appointment.staff_id !== staff.id) return false;
          
          const appointmentStart = timeToMinutes(appointment.start_time.split('T')[1].substring(0, 5));
          const appointmentEnd = timeToMinutes(appointment.end_time.split('T')[1].substring(0, 5));
          
          // Check for overlap (including buffer time)
          return (
            (currentMinutes < appointmentEnd + bufferTime) &&
            (currentMinutes + serviceDuration + bufferTime > appointmentStart)
          );
        });
        
        if (isStaffAvailable) {
          availableStaff.push({
            id: staff.id,
            name: `${staff.first_name} ${staff.last_name}`
          });
        }
      }
      
      if (availableStaff.length > 0) {
        timeSlots.push({
          start_time: slotStartTime,
          end_time: slotEndTime,
          available_staff: availableStaff,
          available_slots: Math.min(availableStaff.length, maxBookingsPerSlot)
        });
      }
    }

    return timeSlots;
  } catch (error: any) {
    throw new Error(`Failed to get available time slots: ${error.message}`);
  }
}

// Helper functions for time conversion
function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get all staff information with their services and working hours
 */
export async function getAllStaffInfo() {
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
      [BUSINESS_ID]
    );

    return result.rows;
  } catch (error: any) {
    throw new Error(`Failed to get staff information: ${error.message}`);
  }
}

/**
 * Get staff member by ID with detailed information
 */
export async function getStaffMember(staff_id: string) {
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
      [BUSINESS_ID, staff_id]
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
export async function getStaffTimeOff(start_date?: string, end_date?: string) {
  try {
    let whereClause = 'WHERE sto.business_id = $1';
    const params = [BUSINESS_ID];
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
export async function checkServiceAvailability(service_name: string, date: string, time?: string) {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    // First, find the service by name
    const serviceResult = await query(
      'SELECT id, name, duration_minutes, buffer_time_minutes, max_bookings_per_slot FROM services WHERE LOWER(name) LIKE LOWER($1) AND business_id = $2 AND is_active = true',
      [`%${service_name}%`, BUSINESS_ID]
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
      [BUSINESS_ID, service.id, date, dayOfWeek]
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
    let appointmentParams = [BUSINESS_ID, service.id, date];
    
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
export async function getServiceTimeSlots(service_name: string, date: string) {
  try {
    const availability = await checkServiceAvailability(service_name, date);
    
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
          const slotAvailability = await checkServiceAvailability(service_name, date, slotStartTime);
          
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
export async function checkBusinessHours(date: string) {
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
      [BUSINESS_ID, dayOfWeek]
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

/**
 * Check for appointment conflicts comprehensively
 */
// Appointment Lifecycle Management Functions
export async function updateAppointment(
  appointment_id: string,
  customer_id: string,
  service_id: string,
  staff_id: string,
  start_time: string,
  end_time: string,
  status: string,
  notes?: string
) {
  try {
    const result = await query(
      'SELECT * FROM update_appointment($1, $2, $3, $4, $5, $6, $7, $8)',
      [appointment_id, customer_id, service_id, staff_id, start_time, end_time, status, notes || '']
    );

    if (!result.rows[0] || !result.rows[0].update_appointment.success) {
      throw new Error(result.rows[0]?.update_appointment?.error || 'Failed to update appointment');
    }

    return result.rows[0].update_appointment;
  } catch (error: any) {
    throw new Error(`Failed to update appointment: ${error.message}`);
  }
}

export async function cancelAppointment(
  appointment_id: string,
  cancellation_reason: string,
  cancelled_by: string
) {
  try {
    const result = await query(
      'SELECT * FROM cancel_appointment($1, $2, $3)',
      [appointment_id, cancellation_reason, cancelled_by]
    );

    if (!result.rows[0] || !result.rows[0].cancel_appointment.success) {
      throw new Error(result.rows[0]?.cancel_appointment?.error || 'Failed to cancel appointment');
    }

    return result.rows[0].cancel_appointment;
  } catch (error: any) {
    throw new Error(`Failed to cancel appointment: ${error.message}`);
  }
}

export async function rescheduleAppointment(
  appointment_id: string,
  new_start_time: string,
  new_end_time: string,
  rescheduled_by: string
) {
  try {
    const result = await query(
      'SELECT * FROM reschedule_appointment($1, $2, $3, $4)',
      [appointment_id, new_start_time, new_end_time, rescheduled_by]
    );

    if (!result.rows[0] || !result.rows[0].reschedule_appointment.success) {
      throw new Error(result.rows[0]?.reschedule_appointment?.error || 'Failed to reschedule appointment');
    }

    return result.rows[0].reschedule_appointment;
  } catch (error: any) {
    throw new Error(`Failed to reschedule appointment: ${error.message}`);
  }
}

export async function confirmAppointment(
  appointment_id: string,
  confirmed_by: string
) {
  try {
    const result = await query(
      'SELECT * FROM confirm_appointment($1, $2)',
      [appointment_id, confirmed_by]
    );

    if (!result.rows[0] || !result.rows[0].confirm_appointment.success) {
      throw new Error(result.rows[0]?.confirm_appointment?.error || 'Failed to confirm appointment');
    }

    return result.rows[0].confirm_appointment;
  } catch (error: any) {
    throw new Error(`Failed to confirm appointment: ${error.message}`);
  }
}

export async function completeAppointment(
  appointment_id: string,
  completed_by: string,
  completion_notes?: string
) {
  try {
    const result = await query(
      'SELECT * FROM complete_appointment($1, $2, $3)',
      [appointment_id, completed_by, completion_notes || '']
    );

    if (!result.rows[0] || !result.rows[0].complete_appointment.success) {
      throw new Error(result.rows[0]?.complete_appointment?.error || 'Failed to complete appointment');
    }

    return result.rows[0].complete_appointment;
  } catch (error: any) {
    throw new Error(`Failed to complete appointment: ${error.message}`);
  }
}



export async function getStaffAvailabilityCalendar(
  staff_id: string,
  start_date: string,
  end_date: string
) {
  try {
    const result = await query(
      'SELECT * FROM get_staff_availability_calendar($1, $2, $3)',
      [staff_id, start_date, end_date]
    );

    if (!result.rows[0] || !result.rows[0].get_staff_availability_calendar.success) {
      throw new Error(result.rows[0]?.get_staff_availability_calendar?.error || 'Failed to get staff availability calendar');
    }

    return result.rows[0].get_staff_availability_calendar;
  } catch (error: any) {
    throw new Error(`Failed to get staff availability calendar: ${error.message}`);
  }
}

export async function checkRealTimeAvailability(
  service_id: string,
  date: string,
  time: string
) {
  try {
    const result = await query(
      'SELECT * FROM check_real_time_availability($1, $2, $3)',
      [service_id, date, time]
    );

    if (!result.rows[0] || !result.rows[0].check_real_time_availability.success) {
      throw new Error(result.rows[0]?.check_real_time_availability?.error || 'Failed to check real-time availability');
    }

    return result.rows[0].check_real_time_availability;
  } catch (error: any) {
    throw new Error(`Failed to check real-time availability: ${error.message}`);
  }
}



// Customer Management Functions (Customer-Focused)
export async function createCustomerValidated(
  first_name: string,
  last_name: string,
  email: string,
  phone: string,
  notes?: string
) {
  try {
    const result = await query(
      'SELECT * FROM create_customer_validated($1, $2, $3, $4, $5)',
      [first_name, last_name, email, phone, notes || null]
    );

    if (!result.rows[0] || !result.rows[0].create_customer_validated.success) {
      throw new Error(result.rows[0]?.create_customer_validated?.error || 'Failed to create customer');
    }

    return result.rows[0].create_customer_validated;
  } catch (error: any) {
    throw new Error(`Failed to create customer: ${error.message}`);
  }
}

export async function updateCustomerProfile(
  customer_id: string,
  first_name: string,
  last_name: string,
  email: string,
  phone: string,
  notes?: string
) {
  try {
    const result = await query(
      'SELECT * FROM update_customer_profile($1, $2, $3, $4, $5, $6)',
      [customer_id, first_name, last_name, email, phone, notes || null]
    );

    if (!result.rows[0] || !result.rows[0].update_customer_profile.success) {
      throw new Error(result.rows[0]?.update_customer_profile?.error || 'Failed to update customer profile');
    }

    return result.rows[0].update_customer_profile;
  } catch (error: any) {
    throw new Error(`Failed to update customer profile: ${error.message}`);
  }
}

export async function getCustomerPreferences(customer_id: string) {
  try {
    const result = await query(
      'SELECT * FROM get_customer_preferences($1)',
      [customer_id]
    );

    if (!result.rows[0] || !result.rows[0].get_customer_preferences.success) {
      throw new Error(result.rows[0]?.get_customer_preferences?.error || 'Failed to get customer preferences');
    }

    return result.rows[0].get_customer_preferences;
  } catch (error: any) {
    throw new Error(`Failed to get customer preferences: ${error.message}`);
  }
}

export async function getCustomerStatistics(customer_id: string) {
  try {
    const result = await query(
      'SELECT * FROM get_customer_statistics($1)',
      [customer_id]
    );

    if (!result.rows[0] || !result.rows[0].get_customer_statistics.success) {
      throw new Error(result.rows[0]?.get_customer_statistics?.error || 'Failed to get customer statistics');
    }

    return result.rows[0].get_customer_statistics;
  } catch (error: any) {
    throw new Error(`Failed to get customer statistics: ${error.message}`);
  }
}

// Booking & Scheduling Functions (Customer-Focused)
export async function createBookingValidated(
  customer_id: string,
  service_id: string,
  staff_id: string,
  start_time: string,
  notes?: string
) {
  try {
    const result = await query(
      'SELECT * FROM create_booking_validated($1, $2, $3, $4, $5)',
      [customer_id, service_id, staff_id, start_time, notes || null]
    );

    if (!result.rows[0] || !result.rows[0].create_booking_validated.success) {
      throw new Error(result.rows[0]?.create_booking_validated?.error || 'Failed to create booking');
    }

    return result.rows[0].create_booking_validated;
  } catch (error: any) {
    throw new Error(`Failed to create booking: ${error.message}`);
  }
}

export async function getBookingConfirmation(appointment_id: string) {
  try {
    const result = await query(
      'SELECT * FROM get_booking_confirmation($1)',
      [appointment_id]
    );

    if (!result.rows[0] || !result.rows[0].get_booking_confirmation.success) {
      throw new Error(result.rows[0]?.get_booking_confirmation?.error || 'Failed to get booking confirmation');
    }

    return result.rows[0].get_booking_confirmation;
  } catch (error: any) {
    throw new Error(`Failed to get booking confirmation: ${error.message}`);
  }
}

export async function getAvailableBookingSlots(
  service_id: string,
  date: string,
  staff_id?: string
) {
  try {
    const result = await query(
      'SELECT * FROM get_available_booking_slots($1, $2, $3)',
      [service_id, date, staff_id || null]
    );

    if (!result.rows[0] || !result.rows[0].get_available_booking_slots.success) {
      throw new Error(result.rows[0]?.get_available_booking_slots?.error || 'Failed to get available booking slots');
    }

    return result.rows[0].get_available_booking_slots;
  } catch (error: any) {
    throw new Error(`Failed to get available booking slots: ${error.message}`);
  }
}



// Additional Customer-Focused Service Discovery Functions
export async function getServicesByPriceRange(
  min_price_cents: number = 0,
  max_price_cents?: number
) {
  try {
    const result = await query(
      'SELECT * FROM get_services_by_price_range($1, $2)',
      [min_price_cents, max_price_cents || null]
    );

    if (!result.rows[0] || !result.rows[0].get_services_by_price_range.success) {
      throw new Error(result.rows[0]?.get_services_by_price_range?.error || 'Failed to get services by price range');
    }

    return result.rows[0].get_services_by_price_range;
  } catch (error: any) {
    throw new Error(`Failed to get services by price range: ${error.message}`);
  }
}

export async function getServicesByDuration(
  min_duration_minutes: number = 0,
  max_duration_minutes?: number
) {
  try {
    const result = await query(
      'SELECT * FROM get_services_by_duration($1, $2)',
      [min_duration_minutes, max_duration_minutes || null]
    );

    if (!result.rows[0] || !result.rows[0].get_services_by_duration.success) {
      throw new Error(result.rows[0]?.get_services_by_duration?.error || 'Failed to get services by duration');
    }

    return result.rows[0].get_services_by_duration;
  } catch (error: any) {
    throw new Error(`Failed to get services by duration: ${error.message}`);
  }
}

export async function getServicesByStaff(staff_id: string) {
  try {
    const result = await query(
      'SELECT * FROM get_services_by_staff($1)',
      [staff_id]
    );

    if (!result.rows[0] || !result.rows[0].get_services_by_staff.success) {
      throw new Error(result.rows[0]?.get_services_by_staff?.error || 'Failed to get services by staff');
    }

    return result.rows[0].get_services_by_staff;
  } catch (error: any) {
    throw new Error(`Failed to get services by staff: ${error.message}`);
  }
}

export async function getServicesByTimeAvailability(
  date: string,
  time?: string
) {
  try {
    const result = await query(
      'SELECT * FROM get_services_by_time_availability($1, $2)',
      [date, time || null]
    );

    if (!result.rows[0] || !result.rows[0].get_services_by_time_availability.success) {
      throw new Error(result.rows[0]?.get_services_by_time_availability?.error || 'Failed to get services by time availability');
    }

    return result.rows[0].get_services_by_time_availability;
  } catch (error: any) {
    throw new Error(`Failed to get services by time availability: ${error.message}`);
  }
}

export async function getPopularServices(limit_count: number = 10) {
  try {
    const result = await query(
      'SELECT * FROM get_popular_services($1)',
      [limit_count]
    );

    if (!result.rows[0] || !result.rows[0].get_popular_services.success) {
      throw new Error(result.rows[0]?.get_popular_services?.error || 'Failed to get popular services');
    }

    return result.rows[0].get_popular_services;
  } catch (error: any) {
    throw new Error(`Failed to get popular services: ${error.message}`);
  }
}

export async function checkAppointmentConflict(
  service_id: string,
  staff_id: string,
  customer_id: string,
  start_time: string,
  end_time: string,
  appointment_id?: string // Optional: exclude current appointment when updating
) {
  try {
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    const dayOfWeek = startDate.getDay();
    const dateOnly = startDate.toISOString().split('T')[0];
    const startTimeOnly = startDate.toTimeString().slice(0, 8);
    const endTimeOnly = endDate.toTimeString().slice(0, 8);

    const conflicts: any[] = [];

    // 1. Check if the service exists and is active
    const serviceResult = await query(
      'SELECT id, name, duration_minutes, max_bookings_per_slot, is_active FROM services WHERE id = $1 AND business_id = $2',
      [service_id, BUSINESS_ID]
    );

    if (serviceResult.rows.length === 0) {
      conflicts.push({
        type: 'SERVICE_NOT_FOUND',
        severity: 'ERROR',
        message: 'Service not found or does not belong to this business'
      });
      return { hasConflicts: true, conflicts };
    }

    const service = serviceResult.rows[0];
    if (!service.is_active) {
      conflicts.push({
        type: 'SERVICE_INACTIVE',
        severity: 'ERROR',
        message: `Service "${service.name}" is not active`
      });
    }

    // 2. Check if staff exists and is active
    const staffResult = await query(
      'SELECT id, first_name, last_name, is_active FROM staff WHERE id = $1 AND business_id = $2',
      [staff_id, BUSINESS_ID]
    );

    if (staffResult.rows.length === 0) {
      conflicts.push({
        type: 'STAFF_NOT_FOUND',
        severity: 'ERROR',
        message: 'Staff member not found or does not belong to this business'
      });
      return { hasConflicts: true, conflicts };
    }

    const staff = staffResult.rows[0];
    if (!staff.is_active) {
      conflicts.push({
        type: 'STAFF_INACTIVE',
        severity: 'ERROR',
        message: `Staff member "${staff.first_name} ${staff.last_name}" is not active`
      });
    }

    // 3. Check if customer exists
    const customerResult = await query(
      'SELECT id, first_name, last_name FROM customers WHERE id = $1 AND business_id = $2',
      [customer_id, BUSINESS_ID]
    );

    if (customerResult.rows.length === 0) {
      conflicts.push({
        type: 'CUSTOMER_NOT_FOUND',
        severity: 'ERROR',
        message: 'Customer not found or does not belong to this business'
      });
      return { hasConflicts: true, conflicts };
    }

    // 4. Check if staff provides this service
    const staffServiceResult = await query(
      'SELECT id FROM staff_services WHERE staff_id = $1 AND service_id = $2',
      [staff_id, service_id]
    );

    if (staffServiceResult.rows.length === 0) {
      conflicts.push({
        type: 'STAFF_SERVICE_MISMATCH',
        severity: 'ERROR',
        message: `Staff member "${staff.first_name} ${staff.last_name}" does not provide service "${service.name}"`
      });
    }

    // 5. Check business hours
    const businessHoursResult = await query(
      'SELECT open_time, close_time, is_closed FROM working_hours WHERE business_id = $1 AND day_of_week = $2',
      [BUSINESS_ID, dayOfWeek]
    );

    if (businessHoursResult.rows.length === 0) {
      conflicts.push({
        type: 'NO_BUSINESS_HOURS',
        severity: 'ERROR',
        message: `No business hours set for this day of week (${dayOfWeek})`
      });
    } else {
      const hours = businessHoursResult.rows[0];
      if (hours.is_closed) {
        conflicts.push({
          type: 'BUSINESS_CLOSED',
          severity: 'ERROR',
          message: 'Business is closed on this day'
        });
      } else if (startTimeOnly < hours.open_time || endTimeOnly > hours.close_time) {
        conflicts.push({
          type: 'OUTSIDE_BUSINESS_HOURS',
          severity: 'ERROR',
          message: `Appointment time (${startTimeOnly}-${endTimeOnly}) is outside business hours (${hours.open_time}-${hours.close_time})`
        });
      }
    }

    // 6. Check staff working hours
    const staffHoursResult = await query(
      'SELECT open_time, close_time, is_available FROM staff_working_hours WHERE staff_id = $1 AND day_of_week = $2',
      [staff_id, dayOfWeek]
    );

    if (staffHoursResult.rows.length === 0) {
      conflicts.push({
        type: 'STAFF_NO_WORKING_HOURS',
        severity: 'ERROR',
        message: `Staff member "${staff.first_name} ${staff.last_name}" does not work on this day`
      });
    } else {
      const staffHours = staffHoursResult.rows[0];
      if (!staffHours.is_available) {
        conflicts.push({
          type: 'STAFF_NOT_AVAILABLE',
          severity: 'ERROR',
          message: `Staff member "${staff.first_name} ${staff.last_name}" is not available on this day`
        });
      } else if (startTimeOnly < staffHours.open_time || endTimeOnly > staffHours.close_time) {
        conflicts.push({
          type: 'OUTSIDE_STAFF_HOURS',
          severity: 'ERROR',
          message: `Appointment time (${startTimeOnly}-${endTimeOnly}) is outside staff hours (${staffHours.open_time}-${staffHours.close_time})`
        });
      }
    }

    // 7. Check staff time off
    const timeOffResult = await query(
      'SELECT title, is_all_day, start_time, end_time FROM staff_time_off WHERE staff_id = $1 AND date = $2::date',
      [staff_id, dateOnly]
    );

    if (timeOffResult.rows.length > 0) {
      const timeOff = timeOffResult.rows[0];
      if (timeOff.is_all_day) {
        conflicts.push({
          type: 'STAFF_TIME_OFF_ALL_DAY',
          severity: 'ERROR',
          message: `Staff member "${staff.first_name} ${staff.last_name}" has all-day time off: "${timeOff.title}"`
        });
      } else if (timeOff.start_time && timeOff.end_time) {
        // Check for partial time off overlap
        if (
          (startTimeOnly >= timeOff.start_time && startTimeOnly < timeOff.end_time) ||
          (endTimeOnly > timeOff.start_time && endTimeOnly <= timeOff.end_time) ||
          (startTimeOnly <= timeOff.start_time && endTimeOnly >= timeOff.end_time)
        ) {
          conflicts.push({
            type: 'STAFF_TIME_OFF_OVERLAP',
            severity: 'ERROR',
            message: `Appointment overlaps with staff time off: "${timeOff.title}" (${timeOff.start_time}-${timeOff.end_time})`
          });
        }
      }
    }

    // 8. Check for double-booking (staff conflicts)
    let staffConflictQuery = `
      SELECT 
        a.id,
        a.start_time,
        a.end_time,
        a.status,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        sv.name as service_name
      FROM appointments a
      JOIN customers c ON a.customer_id = c.id
      JOIN services sv ON a.service_id = sv.id
      WHERE a.staff_id = $1
        AND a.business_id = $2
        AND a.status IN ('confirmed', 'pending', 'scheduled')
        AND (
          (a.start_time >= $3 AND a.start_time < $4) OR
          (a.end_time > $3 AND a.end_time <= $4) OR
          (a.start_time <= $3 AND a.end_time >= $4)
        )`;

    const staffConflictParams = [staff_id, BUSINESS_ID, start_time, end_time];
    
    if (appointment_id) {
      staffConflictQuery += ' AND a.id != $5';
      staffConflictParams.push(appointment_id);
    }

    const staffConflictResult = await query(staffConflictQuery, staffConflictParams);

    if (staffConflictResult.rows.length > 0) {
      const conflict = staffConflictResult.rows[0];
      conflicts.push({
        type: 'STAFF_DOUBLE_BOOKING',
        severity: 'ERROR',
        message: `Staff member "${staff.first_name} ${staff.last_name}" is already booked for ${conflict.service_name} with ${conflict.customer_first_name} ${conflict.customer_last_name} (${conflict.start_time}-${conflict.end_time})`,
        conflictingAppointment: conflict
      });
    }

    // 9. Check for customer double-booking
    let customerConflictQuery = `
      SELECT 
        a.id,
        a.start_time,
        a.end_time,
        a.status,
        s.first_name as staff_first_name,
        s.last_name as staff_last_name,
        sv.name as service_name
      FROM appointments a
      JOIN staff s ON a.staff_id = s.id
      JOIN services sv ON a.service_id = sv.id
      WHERE a.customer_id = $1
        AND a.business_id = $2
        AND a.status IN ('confirmed', 'pending', 'scheduled')
        AND (
          (a.start_time >= $3 AND a.start_time < $4) OR
          (a.end_time > $3 AND a.end_time <= $4) OR
          (a.start_time <= $3 AND a.end_time >= $4)
        )`;

    const customerConflictParams = [customer_id, BUSINESS_ID, start_time, end_time];
    
    if (appointment_id) {
      customerConflictQuery += ' AND a.id != $5';
      customerConflictParams.push(appointment_id);
    }

    const customerConflictResult = await query(customerConflictQuery, customerConflictParams);

    if (customerConflictResult.rows.length > 0) {
      const conflict = customerConflictResult.rows[0];
      conflicts.push({
        type: 'CUSTOMER_DOUBLE_BOOKING',
        severity: 'ERROR',
        message: `Customer "${customerResult.rows[0].first_name} ${customerResult.rows[0].last_name}" is already booked for ${conflict.service_name} with ${conflict.staff_first_name} ${conflict.staff_last_name} (${conflict.start_time}-${conflict.end_time})`,
        conflictingAppointment: conflict
      });
    }

    // 10. Check service booking capacity
    let serviceConflictQuery = `
      SELECT COUNT(*) as appointment_count
      FROM appointments
      WHERE business_id = $1
        AND service_id = $2
        AND DATE(start_time) = $3::date
        AND status IN ('confirmed', 'pending', 'scheduled')
        AND (
          (start_time >= $4 AND start_time < $5) OR
          (end_time > $4 AND end_time <= $5) OR
          (start_time <= $4 AND end_time >= $5)
        )`;

    const serviceConflictParams = [BUSINESS_ID, service_id, dateOnly, start_time, end_time];
    
    if (appointment_id) {
      serviceConflictQuery += ' AND id != $6';
      serviceConflictParams.push(appointment_id);
    }

    const serviceConflictResult = await query(serviceConflictQuery, serviceConflictParams);
    const existingAppointments = parseInt(serviceConflictResult.rows[0].appointment_count);

    if (existingAppointments >= service.max_bookings_per_slot) {
      conflicts.push({
        type: 'SERVICE_CAPACITY_EXCEEDED',
        severity: 'ERROR',
        message: `Service "${service.name}" has reached maximum booking capacity (${service.max_bookings_per_slot} slots) for this time slot`
      });
    }

    // 11. Check for logical time issues
    if (startDate >= endDate) {
      conflicts.push({
        type: 'INVALID_TIME_RANGE',
        severity: 'ERROR',
        message: 'Start time must be before end time'
      });
    }

    if (startDate < new Date()) {
      conflicts.push({
        type: 'PAST_DATE',
        severity: 'WARNING',
        message: 'Appointment is scheduled in the past'
      });
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts,
      summary: {
        totalConflicts: conflicts.length,
        errorCount: conflicts.filter(c => c.severity === 'ERROR').length,
        warningCount: conflicts.filter(c => c.severity === 'WARNING').length,
        canProceed: conflicts.filter(c => c.severity === 'ERROR').length === 0
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to check appointment conflicts: ${error.message}`);
  }
}