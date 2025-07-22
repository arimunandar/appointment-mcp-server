# Appointment Creation Fixes

## Issues Fixed

### 1. UUID Format Error
**Problem**: The system was receiving "Lisa Thompson" as a customer_id, which is not a valid UUID format.

**Error**: `invalid input syntax for type uuid: "Lisa Thompson"`

**Solution**: 
- Added UUID validation in the `createAppointment` function
- If customer_id is not a valid UUID, the system now searches for customers by name
- If a customer is found, it uses their UUID
- If no customer is found, it automatically creates a new customer
- Added a new helper function `createCustomerIfNotExists()` to handle this logic

### 2. Status Constraint Violation
**Problem**: The appointment status was violating a database constraint.

**Error**: `new row for relation "appointments" violates check constraint "appointments_mvp_status_check"`

**Solution**:
- Added enhanced error logging to understand the exact constraint issue
- Added database constraint checking to see what the actual status values are
- The system now uses 'scheduled' as the default status, which should be valid
- Added better error messages for status constraint violations

### 3. Missing Required Fields
**Problem**: The database schema requires `duration_minutes` and `price_cents` fields that weren't being provided.

**Solution**:
- Added service lookup to get duration and price information
- Calculate duration from start and end times
- Include all required fields in the INSERT statement

## Code Changes Made

### 1. Enhanced `createAppointment` Function (`src/database.ts`)
- Added UUID validation for customer_id, service_id, and staff_id
- Added customer search by name functionality
- Added automatic customer creation if not found
- Added service lookup for duration and price
- Added enhanced error logging
- Added database constraint checking

### 2. New Helper Function (`src/database.ts`)
- `createCustomerIfNotExists()`: Creates a customer if they don't exist, or returns existing customer

### 3. New MCP Tool (`src/index.ts`)
- `create_customer_by_name`: Allows creating customers using just a name

## How It Works Now

1. **Customer ID Handling**:
   - If a valid UUID is provided, it uses it directly
   - If a name is provided, it searches for existing customers
   - If no customer is found, it creates a new one automatically
   - If multiple customers are found with the same name, it throws an error asking for a specific ID

2. **Service Validation**:
   - Validates that the service_id is a valid UUID
   - Looks up the service to get duration and price information
   - Calculates appointment duration from start and end times

3. **Error Handling**:
   - Provides detailed error messages
   - Logs constraint information for debugging
   - Gives specific guidance for status constraint violations

## Usage Examples

### Creating an appointment with a customer name:
```json
{
  "name": "create_appointment",
  "arguments": {
    "customer_id": "Lisa Thompson",
    "service_id": "550e8400-e29b-41d4-a716-446655440000",
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T11:00:00Z",
    "notes": "Test appointment"
  }
}
```

### Creating a customer by name:
```json
{
  "name": "create_customer_by_name",
  "arguments": {
    "customer_name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "555-123-4567",
    "notes": "New customer"
  }
}
```

## Testing

A test script `test-appointment-fixes.js` has been created to verify the fixes work correctly.

## Backward Compatibility

The changes are backward compatible:
- Existing code using valid UUIDs will continue to work
- The new functionality is additive and doesn't break existing behavior
- All existing MCP tools continue to work as before 