# Customer Inquiry Resources

This document provides technical resources and reference information for the appointment MCP server's customer inquiry capabilities.

## Database Schema Overview

### Core Tables

#### businesses
- `id` (UUID, Primary Key)
- `name` (Text)
- `description` (Text, Optional)
- `contact_email` (Text, Optional)
- `contact_phone` (Text, Optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### customers
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key)
- `first_name` (Text)
- `last_name` (Text)
- `email` (Text)
- `phone` (Text, Optional)
- `notes` (Text, Optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### services
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key)
- `category_id` (UUID, Foreign Key, Optional)
- `name` (Text)
- `description` (Text, Optional)
- `duration_minutes` (Integer)
- `price_cents` (Integer)
- `is_active` (Boolean)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### appointments
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key)
- `customer_id` (UUID, Foreign Key)
- `service_id` (UUID, Foreign Key)
- `staff_id` (UUID, Foreign Key, Optional)
- `start_time` (Timestamp)
- `end_time` (Timestamp)
- `status` (Text: 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')
- `notes` (Text, Optional)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### staff
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key)
- `first_name` (Text)
- `last_name` (Text)
- `email` (Text)
- `role` (Text)
- `bio` (Text, Optional)
- `avatar_url` (Text, Optional)
- `is_active` (Boolean)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### working_hours
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key)
- `day_of_week` (Integer: 0=Sunday, 6=Saturday)
- `is_open` (Boolean)
- `open_time` (Time, Optional)
- `close_time` (Time, Optional)

#### reviews
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key)
- `appointment_id` (UUID, Foreign Key)
- `customer_id` (UUID, Foreign Key)
- `service_id` (UUID, Foreign Key)
- `staff_id` (UUID, Foreign Key, Optional)
- `rating` (Integer: 1-5)
- `review_text` (Text, Optional)
- `created_at` (Timestamp)

## Tool Reference

### Customer Management Tools

#### create_customer
**Purpose**: Register new customers in the system
**Parameters**:
- `business_id` (required): Business identifier
- `first_name` (required): Customer's first name
- `last_name` (required): Customer's last name
- `email` (required): Customer's email address
- `phone` (optional): Customer's phone number
- `notes` (optional): Additional customer notes

**Returns**: Customer object with generated ID

#### get_customer
**Purpose**: Retrieve specific customer details
**Parameters**:
- `business_id` (required): Business identifier
- `customer_id` (required): Customer identifier

**Returns**: Complete customer information

#### search_customers
**Purpose**: Find customers by partial name, email, or phone
**Parameters**:
- `business_id` (required): Business identifier
- `search_term` (required): Search string (case-insensitive)

**Returns**: Array of matching customers

### Service Information Tools

#### get_services
**Purpose**: List all active services for a business
**Parameters**:
- `business_id` (required): Business identifier

**Returns**: Array of services with category information

#### get_service
**Purpose**: Get detailed service information including assigned staff
**Parameters**:
- `business_id` (required): Business identifier
- `service_id` (required): Service identifier

**Returns**: Service details with staff assignments

### Appointment Tools

#### get_customer_appointments
**Purpose**: Retrieve appointment history for a customer
**Parameters**:
- `business_id` (required): Business identifier
- `customer_id` (required): Customer identifier
- `limit` (optional): Maximum number of appointments to return

**Returns**: Array of appointments with service, staff, and review information

### Business Information Tools

#### get_business_hours
**Purpose**: Get business operating schedule
**Parameters**:
- `business_id` (required): Business identifier

**Returns**: Array of working hours by day of week

#### get_staff
**Purpose**: List all active staff members
**Parameters**:
- `business_id` (required): Business identifier

**Returns**: Array of staff with service assignments

## Data Relationships

### Key Relationships
- Businesses have many customers, services, staff, and appointments
- Customers belong to one business and have many appointments
- Services belong to one business and have many appointments
- Staff belong to one business and can be assigned to multiple services
- Appointments connect customers, services, and optionally staff
- Reviews are linked to specific appointments

### Query Patterns

#### Customer Lookup
```sql
-- Find customer by email
SELECT * FROM customers 
WHERE business_id = ? AND email ILIKE '%search%'

-- Get customer with appointment count
SELECT c.*, COUNT(a.id) as appointment_count
FROM customers c
LEFT JOIN appointments a ON c.id = a.customer_id
WHERE c.business_id = ?
GROUP BY c.id
```

#### Service Information
```sql
-- Get services with categories
SELECT s.*, sc.name as category_name
FROM services s
LEFT JOIN service_categories sc ON s.category_id = sc.id
WHERE s.business_id = ? AND s.is_active = true

-- Get service with assigned staff
SELECT s.*, st.first_name, st.last_name
FROM services s
JOIN staff_services ss ON s.id = ss.service_id
JOIN staff st ON ss.staff_id = st.id
WHERE s.business_id = ? AND s.id = ?
```

#### Appointment History
```sql
-- Customer appointment history with details
SELECT a.*, s.name as service_name, 
       st.first_name as staff_first_name,
       r.rating, r.review_text
FROM appointments a
JOIN services s ON a.service_id = s.id
LEFT JOIN staff st ON a.staff_id = st.id
LEFT JOIN reviews r ON a.id = r.appointment_id
WHERE a.business_id = ? AND a.customer_id = ?
ORDER BY a.start_time DESC
```

## Security Considerations

### Row Level Security (RLS)
All tables implement RLS policies to ensure:
- Data isolation between businesses
- Customers can only access their own data
- Staff can only access their business's data

### Data Validation
- Email format validation
- Phone number formatting
- Date/time validation for appointments
- Business hours validation
- Rating range validation (1-5)

## Performance Considerations

### Indexes
- Business ID indexes on all tables
- Customer email index for quick lookup
- Appointment date indexes for scheduling
- Staff service assignment indexes

### Query Optimization
- Use specific column selection instead of SELECT *
- Implement pagination for large result sets
- Use appropriate JOINs for related data
- Cache frequently accessed business information

## Error Handling Patterns

### Common Error Scenarios
1. **Customer Not Found**: Offer to create new customer
2. **Service Unavailable**: Suggest alternatives
3. **Staff Not Available**: Show available staff or times
4. **Business Closed**: Display hours and suggest alternatives
5. **Duplicate Email**: Handle gracefully with existing customer lookup

### Error Response Format
```json
{
  "error": true,
  "message": "Customer not found",
  "code": "CUSTOMER_NOT_FOUND",
  "suggestions": [
    "Create new customer",
    "Search by different criteria"
  ]
}
```

## Integration Guidelines

### Business ID Management
- Always validate business_id exists
- Use consistent business_id across all operations
- Handle multi-tenant scenarios appropriately

### Customer Data Handling
- Validate email format before storage
- Normalize phone numbers
- Handle duplicate detection gracefully
- Respect privacy preferences

### Appointment Scheduling
- Check business hours before booking
- Validate staff availability
- Handle time zone considerations
- Implement booking confirmation workflows

This resource document should be used alongside the customer inquiry prompt to provide comprehensive support for appointment-based business customer service operations.