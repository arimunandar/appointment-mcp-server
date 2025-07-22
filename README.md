# Appointment MCP Server

A comprehensive Model Context Protocol (MCP) server for managing appointments, staff, and business operations, built with Node.js and TypeScript.

## Features

### Core Appointment Management
- Create new appointments with title, date, time, and optional description
- List all appointments with filtering and sorting options
- Get specific appointment details by ID
- Delete appointments by ID
- Update appointment status and details
- Input validation for date and time formats

### Staff Management
- Get comprehensive staff information with services and working hours
- View staff availability for specific dates
- Get detailed information about individual staff members
- View staff time off schedules
- Staff service assignments and specializations

### Availability & Booking
- Get available time slots for specific services and dates
- Real-time availability checking with booking capacity
- Time slot generation based on service duration and buffer times
- Conflict detection with existing appointments

### Customer Management
- Create and manage customer profiles
- Search customers by name, email, or phone
- Update customer information
- View customer appointment history
- Customer reviews and ratings

### Business Operations
- Multi-business support with API key authentication
- Business hours management
- Service catalog management
- Business details and configuration

### Technical Features
- Persistent storage using PostgreSQL database
- Multi-tenant architecture
- Comprehensive error handling and validation
- TypeScript-first development
- MCP protocol compliance

## Prerequisites

- Node.js version 16 or higher
- npm or yarn package manager
- PostgreSQL database (local or cloud)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Usage

### Configuration

This server is designed to be configured through MCP client settings. Environment variables are passed through the MCP configuration rather than using a .env file.

Required environment variables:
- `DATABASE_URL`: Your PostgreSQL connection string
- `BUSINESS_ID`: Default business ID (can be overridden per tool call)

**Note**: Business IDs are passed dynamically as parameters to each tool call, allowing the server to handle multiple businesses without hardcoded configuration.

### Running the Server

```bash
npm start
```

Or for development:
```bash
npm run dev
```

### MCP Configuration

To use this server with Claude Desktop or other MCP clients, add the following configuration to your MCP settings:

```json
{
  "mcpServers": {
    "appointment-mcp": {
      "command": "node",
      "args": [
        "/path/to/appointment_mcp/build/index.js"
      ],
      "env": {
         "DATABASE_URL": "postgresql://username:password@localhost:5432/database",
         "BUSINESS_ID": "your-default-business-id"
       }
    }
  }
}
```

Or using npx (recommended for published packages):

```json
{
  "mcpServers": {
    "appointment-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "appointment-mcp-server@latest"
      ],
      "env": {
         "DATABASE_URL": "postgresql://username:password@localhost:5432/database",
         "BUSINESS_ID": "your-default-business-id"
       }
    }
  }
}
```

### Local Development

For local development, you can run the server directly:

```bash
npm start
```

Or for development with auto-rebuild:

```bash
npm run dev
```

Note: When running locally for development, you'll need to set environment variables manually or use a .env file.

## Available Tools

### Appointment Management

#### 1. create_appointment
Create a new appointment for a specific business.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `title` (string, required): The title of the appointment
- `date` (string, required): The date in YYYY-MM-DD format
- `time` (string, required): The time in HH:MM format
- `description` (string, optional): Optional description
- `customer_id` (string, optional): Customer ID
- `service_id` (string, optional): Service ID
- `staff_id` (string, optional): Staff member ID

#### 2. list_appointments
List all appointments for a specific business.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `status` (string, optional): Filter by status (confirmed, pending, completed, cancelled)
- `date` (string, optional): Filter by date (YYYY-MM-DD)

#### 3. get_appointment
Get details of a specific appointment for a business.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `id` (string, required): The ID of the appointment

#### 4. delete_appointment
Delete an appointment for a specific business.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `id` (string, required): The ID of the appointment to delete

### Staff Management

#### 5. get_staff_availability
Get staff availability for a specific date.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `date` (string, required): The date to check availability (YYYY-MM-DD format)

**Returns:** Staff members with their working hours, availability status, and time off information.

#### 6. get_all_staff_info
Get detailed information about all staff members.

**Parameters:**
- `business_id` (string, optional): The ID of the business

**Returns:** Comprehensive staff information including services provided, working hours, and appointment counts.

#### 7. get_staff_member
Get detailed information about a specific staff member.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `staff_id` (string, required): The staff member ID

**Returns:** Detailed staff information including services, working hours, and appointment history.

#### 8. get_staff_time_off
Get staff time off for a specific date range.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `start_date` (string, optional): Start date for time off (YYYY-MM-DD format)
- `end_date` (string, optional): End date for time off (YYYY-MM-DD format)

### Availability & Booking

#### 9. get_available_time_slots
Get available time slots for a specific service on a date.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `service_id` (string, required): The service ID
- `date` (string, required): The date to check availability (YYYY-MM-DD format)

**Returns:** Available time slots with staff information and booking capacity.

### Customer Management

#### 10. create_customer
Create a new customer profile.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `first_name` (string, required): Customer's first name
- `last_name` (string, required): Customer's last name
- `email` (string, required): Customer's email address
- `phone_number` (string, optional): Customer's phone number

#### 11. get_customer
Get customer details by ID.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `customer_id` (string, required): The customer ID

#### 12. search_customers
Search customers by name, email, or phone.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `query` (string, required): Search query

#### 13. update_customer
Update customer information.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `customer_id` (string, required): The customer ID
- `first_name` (string, optional): Updated first name
- `last_name` (string, optional): Updated last name
- `email` (string, optional): Updated email
- `phone_number` (string, optional): Updated phone number

#### 14. get_customer_appointments
Get all appointments for a specific customer.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `customer_id` (string, required): The customer ID

#### 15. get_customer_reviews
Get reviews submitted by a customer.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `customer_id` (string, required): The customer ID

#### 16. create_review
Create a new review for an appointment.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `appointment_id` (string, required): The appointment ID
- `rating` (number, required): Rating (1-5)
- `comment` (string, optional): Review comment

### Business Operations

#### 17. get_business_details
Get details of a specific business by business ID.

**Parameters:**
- `business_id` (string, required): The business ID to retrieve details for

#### 18. get_business_hours
Get business operating hours.

**Parameters:**
- `business_id` (string, optional): The ID of the business

### Service Management

#### 19. get_services
Get all services offered by a business.

**Parameters:**
- `business_id` (string, optional): The ID of the business

#### 20. get_service
Get details of a specific service.

**Parameters:**
- `business_id` (string, optional): The ID of the business
- `service_id` (string, required): The service ID

## Database Schema

The server uses a comprehensive PostgreSQL schema that includes:

- **businesses**: Business information and configuration
- **staff**: Staff member profiles and details
- **customers**: Customer profiles and contact information
- **services**: Service offerings with pricing and duration
- **appointments**: Appointment bookings and scheduling
- **staff_working_hours**: Staff availability schedules
- **staff_time_off**: Staff time off and vacation tracking
- **staff_services**: Staff service assignments
- **reviews**: Customer reviews and ratings

See `database_schema.sql` for the complete schema definition.

## Development

### Project Structure

```
appointment_mcp/
├── src/
│   ├── index.ts          # Main server implementation and tool definitions
│   └── database.ts       # Database operations and queries
├── build/                # Compiled JavaScript output
├── database_schema.sql   # Complete database schema
├── customer_inquiry_prompt.md    # Customer service prompts
├── customer_inquiry_resources.md # Customer service resources
├── mcp-config-example.json       # Example MCP configuration
├── test-availability-tools.js    # Test script for new tools
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Building

```bash
npm run build
```

### Testing

Run the test script to verify the new availability tools:

```bash
node test-availability-tools.js
```

### Important Notes

- This server uses STDIO transport, so avoid using `console.log()` in the code as it will corrupt JSON-RPC messages
- Use `console.error()` for logging instead
- All data is stored persistently in PostgreSQL database
- Date format must be YYYY-MM-DD
- Time format must be HH:MM (24-hour format)
- Environment variables must be configured through MCP client settings
- Business IDs are scoped to ensure multi-tenant security

## Version History

### v1.4.0 (Current)
- ✨ Added 5 new availability and staff management tools
- ✨ Enhanced staff information retrieval with services and working hours
- ✨ Added time slot generation for booking availability
- ✨ Improved customer management with reviews and ratings
- ✨ Enhanced business operations and service management
- 🔧 Updated to use direct PostgreSQL queries for better performance
- 📚 Comprehensive documentation and examples

### v1.3.x
- Core appointment management functionality
- Basic customer and business operations
- Multi-tenant support

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- GitHub Issues: https://github.com/arimunandar/appointment-mcp-server/issues
- NPM Package: https://www.npmjs.com/package/appointment-mcp-server
