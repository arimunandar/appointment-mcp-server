#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Simple in-memory appointment storage
interface Appointment {
  id: string;
  title: string;
  date: string;
  time: string;
  description?: string;
}

let appointments: Appointment[] = [];
let nextId = 1;

// Create server instance
const server = new Server(
  {
    name: "appointment-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to generate unique ID
function generateId(): string {
  return (nextId++).toString();
}

// Helper function to validate date format (YYYY-MM-DD)
function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// Helper function to validate time format (HH:MM)
function isValidTime(timeString: string): boolean {
  const regex = /^([01]?\d|2[0-3]):[0-5]\d$/;
  return regex.test(timeString);
}

// Tool: Create appointment
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "create_appointment": {
      const schema = z.object({
        title: z.string().min(1, "Title is required"),
        date: z.string().refine(isValidDate, "Date must be in YYYY-MM-DD format"),
        time: z.string().refine(isValidTime, "Time must be in HH:MM format"),
        description: z.string().optional(),
      });

      try {
        const { title, date, time, description } = schema.parse(args);
        
        const appointment: Appointment = {
          id: generateId(),
          title,
          date,
          time,
          description,
        };
        
        appointments.push(appointment);
        
        return {
          content: [
            {
              type: "text",
              text: `Appointment created successfully!\n\nID: ${appointment.id}\nTitle: ${appointment.title}\nDate: ${appointment.date}\nTime: ${appointment.time}${appointment.description ? `\nDescription: ${appointment.description}` : ''}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "list_appointments": {
      if (appointments.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No appointments found.",
            },
          ],
        };
      }

      const appointmentList = appointments
        .map((apt) => 
          `ID: ${apt.id}\nTitle: ${apt.title}\nDate: ${apt.date}\nTime: ${apt.time}${apt.description ? `\nDescription: ${apt.description}` : ''}\n---`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${appointments.length} appointment(s):\n\n${appointmentList}`,
          },
        ],
      };
    }

    case "get_appointment": {
      const schema = z.object({
        id: z.string().min(1, "Appointment ID is required"),
      });

      try {
        const { id } = schema.parse(args);
        const appointment = appointments.find((apt) => apt.id === id);
        
        if (!appointment) {
          return {
            content: [
              {
                type: "text",
                text: `Appointment with ID ${id} not found.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Appointment Details:\n\nID: ${appointment.id}\nTitle: ${appointment.title}\nDate: ${appointment.date}\nTime: ${appointment.time}${appointment.description ? `\nDescription: ${appointment.description}` : ''}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "delete_appointment": {
      const schema = z.object({
        id: z.string().min(1, "Appointment ID is required"),
      });

      try {
        const { id } = schema.parse(args);
        const index = appointments.findIndex((apt) => apt.id === id);
        
        if (index === -1) {
          return {
            content: [
              {
                type: "text",
                text: `Appointment with ID ${id} not found.`,
              },
            ],
            isError: true,
          };
        }

        const deletedAppointment = appointments.splice(index, 1)[0];
        
        return {
          content: [
            {
              type: "text",
              text: `Appointment "${deletedAppointment.title}" (ID: ${deletedAppointment.id}) has been deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_appointment",
        description: "Create a new appointment",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the appointment",
            },
            date: {
              type: "string",
              description: "The date of the appointment (YYYY-MM-DD format)",
            },
            time: {
              type: "string",
              description: "The time of the appointment (HH:MM format)",
            },
            description: {
              type: "string",
              description: "Optional description of the appointment",
            },
          },
          required: ["title", "date", "time"],
        },
      },
      {
        name: "list_appointments",
        description: "List all appointments",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_appointment",
        description: "Get details of a specific appointment by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the appointment to retrieve",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "delete_appointment",
        description: "Delete an appointment by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the appointment to delete",
            },
          },
          required: ["id"],
        },
      },
    ],
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (not stdout to avoid corrupting JSON-RPC)
  console.error("Appointment MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});