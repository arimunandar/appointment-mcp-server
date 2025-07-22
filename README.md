# Appointment MCP Server

A simple Model Context Protocol (MCP) server for managing appointments, built with Node.js and TypeScript.

## Features

- Create new appointments with title, date, time, and optional description
- List all appointments
- Get specific appointment details by ID
- Delete appointments by ID
- Input validation for date and time formats
- Persistent storage using Supabase database
- Multi-business support with API key authentication

## Prerequisites

- Node.js version 16 or higher
- npm or yarn package manager

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
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key for client-side operations
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key for server-side operations

**Note**: Business IDs are now passed dynamically as parameters to each tool call, allowing the server to handle multiple businesses without hardcoded configuration.

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
         "SUPABASE_URL": "your-supabase-url",
         "SUPABASE_ANON_KEY": "your-supabase-anon-key",
         "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
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
         "SUPABASE_URL": "your-supabase-url",
         "SUPABASE_ANON_KEY": "your-supabase-anon-key",
         "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
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

### 1. create_appointment
Create a new appointment for a specific business.

**Parameters:**
- `business_id` (string, required): The ID of the business
- `title` (string, required): The title of the appointment
- `date` (string, required): The date in YYYY-MM-DD format
- `time` (string, required): The time in HH:MM format
- `description` (string, optional): Optional description

**Example:**
```json
{
  "title": "Doctor Appointment",
  "date": "2024-01-15",
  "time": "14:30",
  "description": "Annual checkup"
}
```

### 2. list_appointments
List all appointments for a specific business.

**Parameters:**
- `business_id` (string, required): The ID of the business

### 3. get_appointment
Get details of a specific appointment for a business.

**Parameters:**
- `business_id` (string, required): The ID of the business
- `id` (string, required): The ID of the appointment

### 4. delete_appointment
Delete an appointment for a specific business.

**Parameters:**
- `business_id` (string, required): The ID of the business
- `id` (string, required): The ID of the appointment to delete

### 5. get_business_details
Get details of a specific business by business ID.

**Parameters:**
- `business_id` (string, required): The business ID to retrieve details for

## Development

### Project Structure

```
appointment_mcp/
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript output
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Building

```bash
npm run build
```

### Important Notes

- This server uses STDIO transport, so avoid using `console.log()` in the code as it will corrupt JSON-RPC messages
- Use `console.error()` for logging instead
- Appointments are stored persistently in Supabase database
- Date format must be YYYY-MM-DD
- Time format must be HH:MM (24-hour format)
- Environment variables must be configured through MCP client settings

## License

MIT# appointment-mcp-server
