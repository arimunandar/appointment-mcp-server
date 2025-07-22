# SQL Functions for Appointment Management System

## Overview
This document summarizes the SQL functions created for the appointment management system. These functions provide comprehensive data access, analytics, and business logic for managing appointments, customers, staff, and services.

## Functions Created

### 1. **get_appointment_details(appointment_id UUID)**
**Purpose**: Retrieves comprehensive details for a specific appointment with all related information.

**Returns**: Complete appointment information including customer, staff, service, and business details.

**Usage Example**:
```sql
SELECT * FROM get_appointment_details('550e8400-e29b-41d4-a716-446655440160'::uuid);
```

**Key Features**:
- Joins appointments with customers, staff, services, and businesses
- Returns formatted names and contact information
- Includes pricing and duration details
- Provides business timezone information

---

### 2. **get_customer_appointment_history(customer_id_param UUID, business_id_param UUID DEFAULT NULL, limit_count INTEGER DEFAULT 50)**
**Purpose**: Retrieves appointment history for a specific customer with service and review details.

**Returns**: Customer's appointment history with ratings, reviews, and days since appointment.

**Usage Example**:
```sql
SELECT * FROM get_customer_appointment_history(
    '550e8400-e29b-41d4-a716-446655440150'::uuid, 
    '2277d67d-f2c5-47bf-8c9e-679080a81477'::uuid, 
    5
);
```

**Key Features**:
- Orders appointments by date (most recent first)
- Includes service duration and pricing
- Shows staff member names
- Includes review ratings and text
- Calculates days since appointment

---

### 3. **get_staff_availability_range(staff_id_param UUID, start_date DATE, end_date DATE)**
**Purpose**: Provides comprehensive staff availability information for a date range.

**Returns**: Daily availability details including working hours, time off, and appointment counts.

**Usage Example**:
```sql
SELECT * FROM get_staff_availability_range(
    '550e8400-e29b-41d4-a716-446655440070'::uuid,
    '2025-07-20'::date,
    '2025-07-27'::date
);
```

**Key Features**:
- Shows daily availability status
- Includes working hours for each day
- Displays time off information (all-day and partial)
- Shows appointment counts and total duration
- Provides day names for better readability

---

### 4. **get_service_availability_with_capacity(service_id_param UUID, business_id_param UUID, target_date DATE, time_slot_interval_minutes INTEGER DEFAULT 30)**
**Purpose**: Generates available time slots for a service considering capacity and staff availability.

**Returns**: Time slots with availability status, staff count, and booking capacity.

**Usage Example**:
```sql
SELECT * FROM get_service_availability_with_capacity(
    '550e8400-e29b-41d4-a716-446655440050'::uuid,
    '2277d67d-f2c5-47bf-8c9e-679080a81477'::uuid,
    '2025-07-23'::date,
    30
);
```

**Key Features**:
- Generates time slots based on business hours
- Checks staff availability for each slot
- Considers service booking capacity
- Shows available staff count and names
- Indicates if slots are available for booking

---

### 5. **get_business_analytics_summary(business_id_param UUID, start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days', end_date DATE DEFAULT CURRENT_DATE)**
**Purpose**: Provides comprehensive business analytics and performance metrics.

**Returns**: Business performance summary including appointments, revenue, ratings, and trends.

**Usage Example**:
```sql
SELECT * FROM get_business_analytics_summary(
    '2277d67d-f2c5-47bf-8c9e-679080a81477'::uuid,
    '2025-01-01'::date,
    '2025-12-31'::date
);
```

**Key Features**:
- Appointment statistics by status
- Total revenue calculation
- Average customer ratings
- Customer, staff, and service counts
- Most popular service identification
- Busiest day analysis
- Average appointment duration

---

### 6. **search_customers_advanced(business_id_param UUID, search_term TEXT DEFAULT NULL, has_appointments BOOLEAN DEFAULT NULL, min_appointments INTEGER DEFAULT NULL, max_appointments INTEGER DEFAULT NULL, has_reviews BOOLEAN DEFAULT NULL, min_rating INTEGER DEFAULT NULL, created_after DATE DEFAULT NULL, created_before DATE DEFAULT NULL, limit_count INTEGER DEFAULT 50, offset_count INTEGER DEFAULT 0)**
**Purpose**: Advanced customer search with multiple filtering options and analytics.

**Returns**: Customer information with appointment history, spending, ratings, and preferences.

**Usage Example**:
```sql
SELECT * FROM search_customers_advanced(
    '2277d67d-f2c5-47bf-8c9e-679080a81477'::uuid,
    'Ahmad',
    true,
    1,
    10,
    true,
    4,
    '2025-01-01'::date,
    '2025-12-31'::date,
    20,
    0
);
```

**Key Features**:
- Text search across name, phone, and email
- Filter by appointment count ranges
- Filter by review ratings
- Date range filtering
- Pagination support
- Customer spending analysis
- Favorite service and staff identification
- Last appointment tracking

---

### 7. **check_appointment_conflicts_comprehensive(business_id_param UUID, service_id_param UUID, staff_id_param UUID, customer_id_param UUID, start_time_param TIMESTAMP, end_time_param TIMESTAMP, exclude_appointment_id UUID DEFAULT NULL)**
**Purpose**: Comprehensive conflict checking for appointment booking with detailed error reporting.

**Returns**: List of conflicts with severity levels and detailed messages.

**Usage Example**:
```sql
SELECT * FROM check_appointment_conflicts_comprehensive(
    '2277d67d-f2c5-47bf-8c9e-679080a81477'::uuid,
    '550e8400-e29b-41d4-a716-446655440050'::uuid,
    '550e8400-e29b-41d4-a716-446655440070'::uuid,
    '550e8400-e29b-41d4-a716-446655440150'::uuid,
    '2025-07-23T14:00:00'::timestamp,
    '2025-07-23T15:00:00'::timestamp
);
```

**Key Features**:
- 11 different types of conflict checks
- Service and staff validation
- Business hours verification
- Staff working hours check
- Time off conflict detection
- Double-booking prevention (staff and customer)
- Service capacity validation
- Logical time range validation
- Detailed error messages with JSON details
- Severity levels (ERROR/WARNING)

---

### 8. **get_staff_performance_analytics(business_id_param UUID, start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days', end_date DATE DEFAULT CURRENT_DATE, staff_id_param UUID DEFAULT NULL)**
**Purpose**: Comprehensive staff performance analytics and metrics.

**Returns**: Staff performance data including appointments, revenue, ratings, and efficiency metrics.

**Usage Example**:
```sql
SELECT * FROM get_staff_performance_analytics(
    '2277d67d-f2c5-47bf-8c9e-679080a81477'::uuid,
    '2025-01-01'::date,
    '2025-12-31'::date
);
```

**Key Features**:
- Appointment completion rates
- Total hours worked calculation
- Revenue generation per staff
- Customer satisfaction ratings
- Most popular services per staff
- Busiest days and time slots
- Availability score calculation
- Performance comparison metrics

---

### 9. **get_service_analytics(business_id_param UUID, start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days', end_date DATE DEFAULT CURRENT_DATE, service_id_param UUID DEFAULT NULL)**
**Purpose**: Service performance analytics and trend analysis.

**Returns**: Service metrics including bookings, revenue, ratings, and popularity trends.

**Usage Example**:
```sql
SELECT * FROM get_service_analytics(
    '2277d67d-f2c5-47bf-8c9e-679080a81477'::uuid,
    '2025-01-01'::date,
    '2025-12-31'::date
);
```

**Key Features**:
- Booking rate analysis
- Revenue generation per service
- Customer satisfaction metrics
- Capacity utilization rates
- Most popular staff per service
- Busiest days and time slots
- Price-performance ratio calculation
- Service popularity trends

## Technical Implementation Details

### Data Types Used
- **UUID**: For all ID fields (appointments, customers, staff, services, businesses)
- **TIMESTAMP**: For date/time fields
- **DATE**: For date-only fields
- **TIME**: For time-only fields
- **TEXT/VARCHAR**: For string fields
- **INTEGER/BIGINT**: For numeric counts and amounts
- **NUMERIC**: For decimal calculations (ratings, percentages)
- **JSONB**: For structured error details and metadata
- **BOOLEAN**: For status flags

### Performance Considerations
- Functions use appropriate indexes on business_id, customer_id, staff_id, service_id
- Date range filtering for efficient querying
- LIMIT clauses to prevent excessive result sets
- Proper JOIN strategies for optimal performance
- Use of CTEs (Common Table Expressions) for complex queries

### Error Handling
- Comprehensive validation in conflict checking function
- Graceful handling of missing data with COALESCE
- Proper NULL handling throughout all functions
- Detailed error messages with context information

### Security Features
- Business-level data isolation
- Parameterized queries to prevent SQL injection
- Proper access control through business_id filtering
- Data validation and sanitization

## Usage Recommendations

### For Application Development
1. **Use `get_appointment_details`** for appointment detail pages
2. **Use `get_customer_appointment_history`** for customer profile pages
3. **Use `get_staff_availability_range`** for staff scheduling interfaces
4. **Use `get_service_availability_with_capacity`** for booking interfaces
5. **Use `check_appointment_conflicts_comprehensive`** before creating appointments
6. **Use analytics functions** for dashboard and reporting features

### For Business Intelligence
1. **Use `get_business_analytics_summary`** for executive dashboards
2. **Use `get_staff_performance_analytics`** for staff management
3. **Use `get_service_analytics`** for service optimization
4. **Use `search_customers_advanced`** for customer relationship management

### For System Integration
1. All functions support the existing MCP tool structure
2. Functions can be called directly from application code
3. Results are structured for easy JSON serialization
4. Functions maintain consistency with existing database schema

## Testing Results

All functions have been tested with real data and verified to work correctly:

✅ **get_appointment_details**: Returns complete appointment information
✅ **get_customer_appointment_history**: Shows customer booking history with reviews
✅ **check_appointment_conflicts_comprehensive**: Correctly identifies conflicts
✅ **get_business_analytics_summary**: Provides comprehensive business metrics
✅ **All other functions**: Working as expected with proper data types and logic

## Future Enhancements

Potential improvements for these functions:
1. Add caching mechanisms for frequently accessed data
2. Implement more granular permission controls
3. Add support for timezone conversions
4. Create additional specialized analytics functions
5. Add support for recurring appointment patterns
6. Implement real-time availability updates

---

*These SQL functions provide a robust foundation for the appointment management system, offering comprehensive data access, analytics, and business logic while maintaining performance and security standards.* 