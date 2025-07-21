# Appointment MCP Server

A simple Model Context Protocol (MCP) server for managing appointments, built with Node.js and TypeScript.

## Features

- Create new appointments with title, date, time, and optional description
- List all appointments
- Get specific appointment details by ID
- Delete appointments by ID
- Input validation for date and time formats
- In-memory storage (appointments are lost when server restarts)

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
      "args": ["/path/to/appointment_mcp/build/index.js"]
    }
  }
}
```

Or if you want to use npx (after publishing to npm):

```json
{
  "mcpServers": {
    "appointment-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "appointment-mcp-server@latest"
      ]
    }
  }
}
```

## Available Tools

### 1. create_appointment
Create a new appointment.

**Parameters:**
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
List all appointments.

**Parameters:** None

### 3. get_appointment
Get details of a specific appointment.

**Parameters:**
- `id` (string, required): The ID of the appointment

### 4. delete_appointment
Delete an appointment.

**Parameters:**
- `id` (string, required): The ID of the appointment to delete

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
- Appointments are stored in memory and will be lost when the server restarts
- Date format must be YYYY-MM-DD
- Time format must be HH:MM (24-hour format)

## License

MIT# appointment-mcp-server
