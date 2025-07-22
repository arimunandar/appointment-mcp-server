#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  pool,
  createAppointment,
  getAppointments,
  getAppointment,
  deleteAppointment,
  ensureBusinessExists,
  getBusinessDetails,
  verifyDatabaseConnection,
  createCustomer,
  getCustomer,
  searchCustomers,
  updateCustomer,
  getServices,
  getService,
  getServiceByName,
  searchServicesFuzzy,
  searchServicesComprehensive,
  getCustomerAppointments,
  getBusinessHours,
  getStaff,
  getCustomerReviews,
  createReview,
  getStaffAvailability,
  getAvailableTimeSlots,
  getAllStaffInfo,
  getStaffMember,
  getStaffTimeOff,
  checkServiceAvailability,
  getServiceTimeSlots,
  checkBusinessHours,
  checkAppointmentConflict,
  // New Phase 1 functions
  updateAppointment,
  cancelAppointment,
  rescheduleAppointment,
  confirmAppointment,
  completeAppointment,
  getStaffAvailabilityCalendar,
  checkRealTimeAvailability,
  // Phase 2 Customer-Focused Functions
  createCustomerValidated,
  updateCustomerProfile,
  getCustomerPreferences,
  getCustomerStatistics,
  createBookingValidated,
  getBookingConfirmation,
  getAvailableBookingSlots,
  // Additional Customer-Focused Service Discovery Functions
  getServicesByPriceRange,
  getServicesByDuration,
  getServicesByStaff,
  getServicesByTimeAvailability,
  getPopularServices
} from "./database.js";

// Get BUSINESS_ID from environment variables
const DEFAULT_BUSINESS_ID = process.env.BUSINESS_ID;

if (!DEFAULT_BUSINESS_ID) {
  console.warn('Warning: BUSINESS_ID environment variable not set. All operations will require explicit business_id parameter.');
}

// Helper function to get business ID (use provided or default)
function getBusinessId(providedBusinessId?: string): string {
  const businessId = providedBusinessId || DEFAULT_BUSINESS_ID;
  if (!businessId) {
    throw new Error('Business ID is required. Either provide business_id parameter or set BUSINESS_ID environment variable.');
  }
  return businessId;
}

// Create server instance
const server = new Server(
  {
    name: "appointment-mcp-server",
    version: "1.7.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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
        customer_id: z.string().min(1, "Customer ID is required"),
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().optional(),
        start_time: z.string().min(1, "Start time is required"),
        end_time: z.string().min(1, "End time is required"),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);

        const appointmentData = { ...parsedArgs };
        
        // Ensure business exists
        await ensureBusinessExists();
        
        const appointment = await createAppointment(appointmentData);
        
        return {
          content: [
            {
              type: "text",
              text: `Appointment created successfully!\n\nID: ${appointment.id}\nCustomer ID: ${appointment.customer_id}\nService ID: ${appointment.service_id}\nStart Time: ${appointment.start_time}\nEnd Time: ${appointment.end_time}${appointment.notes ? `\nNotes: ${appointment.notes}` : ''}`,
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
      const schema = z.object({
        customer_id: z.string().optional(),
        service_id: z.string().optional(),
        staff_id: z.string().optional(),
        status: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const filters = parsedArgs;
        
        const appointments = await getAppointments(filters);

        if (!appointments || appointments.length === 0) {
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
          .map((apt: any) => 
            `ID: ${apt.id}\nCustomer: ${apt.customer_first_name} ${apt.customer_last_name}\nService: ${apt.service_name}\nStaff: ${apt.staff_first_name ? `${apt.staff_first_name} ${apt.staff_last_name}` : 'Not assigned'}\nStart: ${apt.start_time}\nEnd: ${apt.end_time}\nStatus: ${apt.status}\n---`
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
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing appointments: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_appointment": {
      const schema = z.object({
        id: z.string().min(1, "Appointment ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { id } = parsedArgs;
        
        const appointment = await getAppointment(id);

        return {
          content: [
            {
              type: "text",
              text: `Appointment Details:\n\nID: ${appointment.id}\nCustomer: ${appointment.customer_first_name} ${appointment.customer_last_name}\nEmail: ${appointment.customer_email}\nPhone: ${appointment.customer_phone || 'Not provided'}\nService: ${appointment.service_name}\nDescription: ${appointment.service_description || 'No description'}\nDuration: ${appointment.duration_minutes} minutes\nPrice: $${(appointment.price_cents / 100).toFixed(2)}\nStaff: ${appointment.staff_first_name ? `${appointment.staff_first_name} ${appointment.staff_last_name}` : 'Not assigned'}\nStart Time: ${appointment.start_time}\nEnd Time: ${appointment.end_time}\nStatus: ${appointment.status}\nNotes: ${appointment.notes || 'No notes'}\nCreated: ${new Date(appointment.created_at).toLocaleString()}`,
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
        const parsedArgs = schema.parse(args);
        const { id } = parsedArgs;
        
        const deletedAppointment = await deleteAppointment(id);

        return {
          content: [
            {
              type: "text",
              text: `Appointment deleted successfully!\n\nDeleted appointment ID: ${deletedAppointment.id}\nCustomer ID: ${deletedAppointment.customer_id}\nService ID: ${deletedAppointment.service_id}\nStart Time: ${deletedAppointment.start_time}`,
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

    // Business Information Tools
    case "get_business": {
      const schema = z.object({
      });

      try {
        const parsedArgs = schema.parse(args);

        
        const business = await getBusinessDetails();
        
        return {
          content: [
            {
              type: "text",
              text: `Business Details:\n\nID: ${business.id}\nName: ${business.name}\nDescription: ${business.description || 'No description'}\nAddress: ${business.address || 'Not provided'}\nPhone: ${business.phone || 'Not provided'}\nEmail: ${business.email || 'Not provided'}\nWebsite: ${business.website || 'Not provided'}\nTimezone: ${business.timezone || 'Not specified'}\nCreated: ${new Date(business.created_at).toLocaleString()}\nUpdated: ${new Date(business.updated_at).toLocaleString()}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving business details: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Customer Management Tools
    case "create_customer": {
      const schema = z.object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string(),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const customerData = parsedArgs;
        
        await ensureBusinessExists();
        const customer = await createCustomer(customerData);
        
        return {
          content: [
            {
              type: "text",
              text: `Customer created successfully!\n\nID: ${customer.id}\nName: ${customer.first_name} ${customer.last_name}\nEmail: ${customer.email}\nPhone: ${customer.phone_number || 'Not provided'}\nNotes: ${customer.notes || 'No notes'}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_customer": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { customer_id } = parsedArgs;
        
        const customer = await getCustomer(customer_id);
        
        return {
          content: [
            {
              type: "text",
              text: `Customer Details:\n\nID: ${customer.id}\nName: ${customer.first_name} ${customer.last_name}\nEmail: ${customer.email}\nPhone: ${customer.phone_number || 'Not provided'}\nNotes: ${customer.notes || 'No notes'}\nCreated: ${new Date(customer.created_at).toLocaleString()}\nUpdated: ${new Date(customer.updated_at).toLocaleString()}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "search_customers": {
      const schema = z.object({
        search_term: z.string().min(1, "Search term is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { search_term } = parsedArgs;
        
        const customers = await searchCustomers(search_term);
        
        if (!customers || customers.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No customers found matching "${search_term}".`,
              },
            ],
          };
        }

        const customerList = customers
          .map((customer: any) => 
            `ID: ${customer.id}\nName: ${customer.first_name} ${customer.last_name}\nEmail: ${customer.email}\nPhone: ${customer.phone_number || 'Not provided'}\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${customers.length} customer(s) matching "${search_term}":\n\n${customerList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching customers: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Service Information Tools
    case "get_services": {
      const schema = z.object({
      });

      try {
        const parsedArgs = schema.parse(args);

        
        const services = await getServices();
        
        if (!services || services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No services found.",
              },
            ],
          };
        }

        const serviceList = services
          .map((service: any) => 
            `ID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: $${(service.price_cents / 100).toFixed(2)}\nCategory: ${service.category_name || 'Uncategorized'}\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${services.length} service(s):\n\n${serviceList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving services: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_service": {
      const schema = z.object({
        service_id: z.string().min(1, "Service ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { service_id } = parsedArgs;
        
        const service = await getService(service_id);
        
        const staffList = service.staff && service.staff.length > 0 
          ? service.staff.map((staff: any) => `${staff.first_name} ${staff.last_name}`).join(', ')
          : 'No staff assigned';
        
        return {
          content: [
            {
              type: "text",
              text: `Service Details:\n\nID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: $${(service.price_cents / 100).toFixed(2)}\nCategory: ${service.category_name || 'Uncategorized'}\nCategory Description: ${service.category_description || 'No category description'}\nAvailable Staff: ${staffList}\nActive: ${service.is_active ? 'Yes' : 'No'}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving service: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_service_by_name": {
      const schema = z.object({
        service_name: z.string().min(1, "Service name is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { service_name } = parsedArgs;
        
        const services = await getServiceByName(service_name);
        
        if (!services || services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No services found matching "${service_name}".`,
              },
            ],
          };
        }

        const serviceList = services
          .map((service: any) => {
            const staffList = service.staff && service.staff.length > 0 
              ? service.staff.map((staff: any) => `${staff.first_name} ${staff.last_name}`).join(', ')
              : 'No staff assigned';
            
            return `ID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: $${(service.price_cents / 100).toFixed(2)}\nCategory: ${service.category_name || 'Uncategorized'}\nAvailable Staff: ${staffList}\nStaff Count: ${service.staff_count}\nActive: ${service.is_active ? 'Yes' : 'No'}\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${services.length} service(s) matching "${service_name}":\n\n${serviceList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving service by name: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "search_services_fuzzy": {
      const schema = z.object({
        service_name: z.string().min(1, "Service name is required"),
        similarity_threshold: z.number().min(0).max(1).optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { service_name, similarity_threshold = 0.3 } = parsedArgs;
        
        const services = await searchServicesFuzzy(service_name, similarity_threshold);
        
        if (!services || services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No services found matching "${service_name}" with similarity threshold ${similarity_threshold}.`,
              },
            ],
          };
        }

        const serviceList = services
          .map((service: any) => {
            const staffList = service.staff && service.staff.length > 0 
              ? service.staff.map((staff: any) => `${staff.first_name} ${staff.last_name}`).join(', ')
              : 'No staff assigned';
            
            return `ID: ${service.service_id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: $${(service.price_cents / 100).toFixed(2)}\nSimilarity Score: ${(service.similarity_score * 100).toFixed(1)}%\nCategory: ${service.category?.name || 'Uncategorized'}\nAvailable Staff: ${staffList}\nStaff Count: ${service.staff_count}\nActive: ${service.is_active ? 'Yes' : 'No'}\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${services.length} service(s) matching "${service_name}" (fuzzy search):\n\n${serviceList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching services with fuzzy matching: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "search_services_comprehensive": {
      const schema = z.object({
        search_term: z.string().min(1, "Search term is required"),
        similarity_threshold: z.number().min(0).max(1).optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { search_term, similarity_threshold = 0.3 } = parsedArgs;
        
        const services = await searchServicesComprehensive(search_term, similarity_threshold);
        
        if (!services || services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No services found matching "${search_term}" with comprehensive search.`,
              },
            ],
          };
        }

        const serviceList = services
          .map((service: any) => {
            const staffList = service.staff && service.staff.length > 0 
              ? service.staff.map((staff: any) => `${staff.first_name} ${staff.last_name}`).join(', ')
              : 'No staff assigned';
            
            return `ID: ${service.service_id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: $${(service.price_cents / 100).toFixed(2)}\nSearch Score: ${service.search_score}/100\nMatch Type: ${service.match_type}\nMatched Field: ${service.matched_field}\nCategory: ${service.category?.name || 'Uncategorized'}\nAvailable Staff: ${staffList}\nStaff Count: ${service.staff_count}\nActive: ${service.is_active ? 'Yes' : 'No'}\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${services.length} service(s) matching "${search_term}" (comprehensive search):\n\n${serviceList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching services comprehensively: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Customer-Focused Appointment Management
    case "update_appointment": {
      const schema = z.object({
        appointment_id: z.string().min(1, "Appointment ID is required"),
        customer_id: z.string().min(1, "Customer ID is required"),
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().min(1, "Staff ID is required"),
        start_time: z.string().min(1, "Start time is required"),
        end_time: z.string().min(1, "End time is required"),
        status: z.string().min(1, "Status is required"),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await updateAppointment(
          parsedArgs.appointment_id,
          parsedArgs.customer_id,
          parsedArgs.service_id,
          parsedArgs.staff_id,
          parsedArgs.start_time,
          parsedArgs.end_time,
          parsedArgs.status,
          parsedArgs.notes
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Appointment updated successfully!\n\nAppointment ID: ${result.appointment.id}\nStatus: ${result.appointment.status}\nUpdated at: ${result.appointment.updated_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "cancel_appointment": {
      const schema = z.object({
        appointment_id: z.string().min(1, "Appointment ID is required"),
        cancellation_reason: z.string().min(1, "Cancellation reason is required"),
        cancelled_by: z.string().min(1, "Cancelled by is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await cancelAppointment(
          parsedArgs.appointment_id,
          parsedArgs.cancellation_reason,
          parsedArgs.cancelled_by
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Appointment cancelled successfully!\n\nAppointment ID: ${result.cancellation.appointment_id}\nCancellation Reason: ${parsedArgs.cancellation_reason}\nCancelled by: ${parsedArgs.cancelled_by}\nCancelled at: ${result.cancellation.cancelled_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error cancelling appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "reschedule_appointment": {
      const schema = z.object({
        appointment_id: z.string().min(1, "Appointment ID is required"),
        new_start_time: z.string().min(1, "New start time is required"),
        new_end_time: z.string().min(1, "New end time is required"),
        rescheduled_by: z.string().min(1, "Rescheduled by is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await rescheduleAppointment(
          parsedArgs.appointment_id,
          parsedArgs.new_start_time,
          parsedArgs.new_end_time,
          parsedArgs.rescheduled_by
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Appointment rescheduled successfully!\n\nAppointment ID: ${result.reschedule.appointment_id}\nOld Start Time: ${result.reschedule.old_start_time}\nNew Start Time: ${result.reschedule.new_start_time}\nRescheduled by: ${parsedArgs.rescheduled_by}\nRescheduled at: ${result.reschedule.rescheduled_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error rescheduling appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "confirm_appointment": {
      const schema = z.object({
        appointment_id: z.string().min(1, "Appointment ID is required"),
        confirmed_by: z.string().min(1, "Confirmed by is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await confirmAppointment(
          parsedArgs.appointment_id,
          parsedArgs.confirmed_by
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Appointment confirmed successfully!\n\nAppointment ID: ${result.confirmation.appointment_id}\nStatus: ${result.confirmation.status}\nConfirmed by: ${parsedArgs.confirmed_by}\nConfirmed at: ${result.confirmation.confirmed_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error confirming appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "complete_appointment": {
      const schema = z.object({
        appointment_id: z.string().min(1, "Appointment ID is required"),
        completed_by: z.string().min(1, "Completed by is required"),
        completion_notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await completeAppointment(
          parsedArgs.appointment_id,
          parsedArgs.completed_by,
          parsedArgs.completion_notes
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Appointment completed successfully!\n\nAppointment ID: ${result.completion.appointment_id}\nStatus: ${result.completion.status}\nCompletion Notes: ${parsedArgs.completion_notes || 'None'}\nCompleted by: ${parsedArgs.completed_by}\nCompleted at: ${result.completion.completed_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error completing appointment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "check_real_time_availability": {
      const schema = z.object({
        service_id: z.string().min(1, "Service ID is required"),
        date: z.string().min(1, "Date is required"),
        time: z.string().min(1, "Time is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await checkRealTimeAvailability(
          parsedArgs.service_id,
          parsedArgs.date,
          parsedArgs.time
        );

        const availabilityText = result.available 
          ? `✅ Available! ${result.reason}\n\nRemaining slots: ${result.remaining_slots}\nAvailable staff: ${result.available_staff}`
          : `❌ Not available: ${result.reason}\n\nExisting bookings: ${result.existing_bookings}\nMax bookings: ${result.max_bookings}\nAvailable staff: ${result.available_staff}`;

        return {
          content: [
            {
              type: "text",
              text: `Real-time availability check for ${parsedArgs.date} at ${parsedArgs.time}:\n\n${availabilityText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking real-time availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_staff_availability_calendar": {
      const schema = z.object({
        staff_id: z.string().min(1, "Staff ID is required"),
        start_date: z.string().min(1, "Start date is required"),
        end_date: z.string().min(1, "End date is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getStaffAvailabilityCalendar(
          parsedArgs.staff_id,
          parsedArgs.start_date,
          parsedArgs.end_date
        );

        if (!result.availability || result.availability.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No availability data found for staff member from ${parsedArgs.start_date} to ${parsedArgs.end_date}.`,
              },
            ],
          };
        }

        const calendarText = result.availability
          .map((day: any) => {
            const status = day.is_available ? '✅ Available' : '❌ Not Available';
            const appointments = day.appointments && day.appointments.length > 0
              ? day.appointments.map((apt: any) => `${apt.service_name} with ${apt.customer_name} (${apt.start_time})`).join(', ')
              : 'No appointments';
            
            return `${day.date} (${day.day_name}): ${status}\nWorking Hours: ${day.working_hours || 'Not set'}\nAppointments: ${appointments}\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Staff Availability Calendar for ${parsedArgs.start_date} to ${parsedArgs.end_date}:\n\n${calendarText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting staff availability calendar: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Phase 2 Customer-Focused Tools
    case "create_customer_validated": {
      const schema = z.object({
        first_name: z.string().min(1, "First name is required"),
        last_name: z.string().min(1, "Last name is required"),
        email: z.string().email("Invalid email format"),
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await createCustomerValidated(
          parsedArgs.first_name,
          parsedArgs.last_name,
          parsedArgs.email,
          parsedArgs.phone,
          parsedArgs.notes
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Customer created successfully!\n\nCustomer ID: ${result.customer.id}\nName: ${result.customer.first_name} ${result.customer.last_name}\nEmail: ${result.customer.email}\nPhone: ${result.customer.phone_number}\nCreated: ${result.customer.created_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "update_customer_profile": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
        first_name: z.string().min(1, "First name is required"),
        last_name: z.string().min(1, "Last name is required"),
        email: z.string().email("Invalid email format"),
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await updateCustomerProfile(
          parsedArgs.customer_id,
          parsedArgs.first_name,
          parsedArgs.last_name,
          parsedArgs.email,
          parsedArgs.phone,
          parsedArgs.notes
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Customer profile updated successfully!\n\nCustomer ID: ${result.customer.id}\nName: ${result.customer.first_name} ${result.customer.last_name}\nEmail: ${result.customer.email}\nPhone: ${result.customer.phone_number}\nUpdated: ${result.customer.updated_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating customer profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_customer_preferences": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getCustomerPreferences(parsedArgs.customer_id);

        const preferences = result.preferences;
        const preferredServices = preferences.preferred_services || [];
        const preferredStaff = preferences.preferred_staff || [];
        const preferredTimeSlots = preferences.preferred_time_slots || [];

        let preferencesText = `Customer Preferences for ${parsedArgs.customer_id}:\n\n`;
        
        if (preferredServices.length > 0) {
          preferencesText += `Preferred Services:\n${preferredServices.map((service: any) => 
            `- ${service.service_name} (${service.booking_count} bookings, last: ${service.last_booking})`
          ).join('\n')}\n\n`;
        }

        if (preferredStaff.length > 0) {
          preferencesText += `Preferred Staff:\n${preferredStaff.map((staff: any) => 
            `- ${staff.staff_name} (${staff.booking_count} bookings, last: ${staff.last_booking})`
          ).join('\n')}\n\n`;
        }

        if (preferredTimeSlots.length > 0) {
          preferencesText += `Preferred Time Slots:\n${preferredTimeSlots.map((slot: any) => 
            `- ${slot.time_slot} (${slot.booking_count} bookings)`
          ).join('\n')}\n\n`;
        }

        preferencesText += `Total Appointments: ${preferences.total_appointments}\n`;
        preferencesText += `Completed Appointments: ${preferences.completed_appointments}\n`;
        preferencesText += `Average Rating: ${preferences.average_rating.toFixed(1)}/5`;

        return {
          content: [
            {
              type: "text",
              text: preferencesText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting customer preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_customer_statistics": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getCustomerStatistics(parsedArgs.customer_id);

        const stats = result.statistics;
        const aptStats = stats.appointment_stats;
        const serviceStats = stats.service_stats;
        const staffStats = stats.staff_stats;
        const reviewStats = stats.review_stats;
        const loyaltyStats = stats.loyalty_stats;

        let statsText = `Customer Statistics for ${parsedArgs.customer_id}:\n\n`;
        
        statsText += `📊 Appointment Statistics:\n`;
        statsText += `- Total Appointments: ${aptStats.total_appointments}\n`;
        statsText += `- Completed: ${aptStats.completed_appointments}\n`;
        statsText += `- Cancelled: ${aptStats.cancelled_appointments}\n`;
        statsText += `- Upcoming: ${aptStats.upcoming_appointments}\n`;
        statsText += `- First Appointment: ${aptStats.first_appointment || 'N/A'}\n`;
        statsText += `- Last Appointment: ${aptStats.last_appointment || 'N/A'}\n\n`;

        statsText += `💰 Service Statistics:\n`;
        statsText += `- Services Used: ${serviceStats.total_services_used}\n`;
        statsText += `- Most Used Service: ${serviceStats.most_used_service || 'N/A'}\n`;
        statsText += `- Total Spent: $${(serviceStats.total_spent / 100).toFixed(2)}\n\n`;

        statsText += `👥 Staff Statistics:\n`;
        statsText += `- Staff Seen: ${staffStats.total_staff_seen}\n`;
        statsText += `- Preferred Staff: ${staffStats.preferred_staff || 'N/A'}\n\n`;

        statsText += `⭐ Review Statistics:\n`;
        statsText += `- Total Reviews: ${reviewStats.total_reviews}\n`;
        statsText += `- Average Rating: ${reviewStats.average_rating.toFixed(1)}/5\n`;
        statsText += `- Last Review: ${reviewStats.last_review_date || 'N/A'}\n\n`;

        statsText += `🎯 Loyalty Statistics:\n`;
        statsText += `- Customer Since: ${loyaltyStats.customer_since}\n`;
        statsText += `- Days Since Last Visit: ${loyaltyStats.days_since_last_visit || 'N/A'}\n`;
        statsText += `- Visit Frequency: ${loyaltyStats.visit_frequency ? loyaltyStats.visit_frequency.toFixed(1) + ' days' : 'N/A'}`;

        return {
          content: [
            {
              type: "text",
              text: statsText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting customer statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "create_booking_validated": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().min(1, "Staff ID is required"),
        start_time: z.string().min(1, "Start time is required"),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await createBookingValidated(
          parsedArgs.customer_id,
          parsedArgs.service_id,
          parsedArgs.staff_id,
          parsedArgs.start_time,
          parsedArgs.notes
        );

        return {
          content: [
            {
              type: "text",
              text: `✅ Booking created successfully!\n\nAppointment ID: ${result.booking.appointment_id}\nCustomer ID: ${result.booking.customer_id}\nService ID: ${result.booking.service_id}\nStaff ID: ${result.booking.staff_id}\nStart Time: ${result.booking.start_time}\nEnd Time: ${result.booking.end_time}\nStatus: ${result.booking.status}\nCreated: ${result.booking.created_at}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_booking_confirmation": {
      const schema = z.object({
        appointment_id: z.string().min(1, "Appointment ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getBookingConfirmation(parsedArgs.appointment_id);

        const confirmation = result.confirmation;
        const customer = confirmation.customer;
        const service = confirmation.service;
        const staff = confirmation.staff;
        const appointment = confirmation.appointment;
        const business = confirmation.business;

        let confirmationText = `📋 Booking Confirmation\n\n`;
        confirmationText += `Confirmation Code: ${confirmation.confirmation_code}\n\n`;
        
        confirmationText += `👤 Customer:\n`;
        confirmationText += `- Name: ${customer.name}\n`;
        confirmationText += `- Email: ${customer.email}\n`;
        confirmationText += `- Phone: ${customer.phone}\n\n`;

        confirmationText += `🛠️ Service:\n`;
        confirmationText += `- Name: ${service.name}\n`;
        confirmationText += `- Description: ${service.description || 'N/A'}\n`;
        confirmationText += `- Duration: ${service.duration_minutes} minutes\n`;
        confirmationText += `- Price: ${service.price_formatted}\n\n`;

        if (staff) {
          confirmationText += `👨‍⚕️ Staff:\n`;
          confirmationText += `- Name: ${staff.name}\n`;
          confirmationText += `- Email: ${staff.email}\n`;
          confirmationText += `- Phone: ${staff.phone}\n\n`;
        }

        confirmationText += `📅 Appointment:\n`;
        confirmationText += `- Start Time: ${appointment.start_time}\n`;
        confirmationText += `- End Time: ${appointment.end_time}\n`;
        confirmationText += `- Duration: ${appointment.duration_minutes} minutes\n`;
        confirmationText += `- Status: ${appointment.status}\n`;
        if (appointment.notes) {
          confirmationText += `- Notes: ${appointment.notes}\n`;
        }
        confirmationText += `\n🏢 Business:\n`;
        confirmationText += `- Name: ${business.name}\n`;
        confirmationText += `- Phone: ${business.phone}\n\n`;
        confirmationText += `Created: ${confirmation.created_at}`;

        return {
          content: [
            {
              type: "text",
              text: confirmationText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting booking confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_available_booking_slots": {
      const schema = z.object({
        service_id: z.string().min(1, "Service ID is required"),
        date: z.string().min(1, "Date is required"),
        staff_id: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getAvailableBookingSlots(
          parsedArgs.service_id,
          parsedArgs.date,
          parsedArgs.staff_id
        );

        if (!result.available_slots || result.available_slots.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No available booking slots found for service on ${parsedArgs.date}.`,
              },
            ],
          };
        }

        const slotsText = result.available_slots
          .map((slot: any, index: number) => {
            const staffList = slot.available_staff && slot.available_staff.length > 0
              ? slot.available_staff.map((staff: any) => staff.name).join(', ')
              : 'No staff assigned';
            
            return `${index + 1}. ${slot.start_time} - ${slot.end_time}\n   Available Staff: ${staffList}\n   Available Slots: ${slot.available_slots}`;
          })
          .join('\n\n');

        return {
          content: [
            {
              type: "text",
              text: `Available Booking Slots for ${parsedArgs.date}:\n\n${slotsText}\n\nTotal Slots: ${result.total_slots}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting available booking slots: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Additional Customer-Focused Service Discovery Tools
    case "get_services_by_price_range": {
      const schema = z.object({
        min_price_cents: z.number().min(0, "Minimum price must be 0 or greater").optional(),
        max_price_cents: z.number().min(0, "Maximum price must be 0 or greater").optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getServicesByPriceRange(
          parsedArgs.min_price_cents || 0,
          parsedArgs.max_price_cents
        );

        if (!result.services || result.services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No services found in the specified price range.`,
              },
            ],
          };
        }

        const servicesText = result.services
          .map((service: any) => 
            `ID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: ${service.price_formatted}\nCategory: ${service.category_name || 'Uncategorized'}\nStaff Count: ${service.staff_count}\nActive: ${service.is_active ? 'Yes' : 'No'}\n---`
          )
          .join("\n");

        const priceRange = parsedArgs.max_price_cents 
          ? `$${(parsedArgs.min_price_cents || 0) / 100} - $${parsedArgs.max_price_cents / 100}`
          : `$${(parsedArgs.min_price_cents || 0) / 100} and above`;

        return {
          content: [
            {
              type: "text",
              text: `Found ${result.services.length} service(s) in price range ${priceRange}:\n\n${servicesText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting services by price range: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_services_by_duration": {
      const schema = z.object({
        min_duration_minutes: z.number().min(0, "Minimum duration must be 0 or greater").optional(),
        max_duration_minutes: z.number().min(0, "Maximum duration must be 0 or greater").optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getServicesByDuration(
          parsedArgs.min_duration_minutes || 0,
          parsedArgs.max_duration_minutes
        );

        if (!result.services || result.services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No services found in the specified duration range.`,
              },
            ],
          };
        }

        const servicesText = result.services
          .map((service: any) => 
            `ID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_formatted}\nPrice: ${service.price_formatted}\nCategory: ${service.category_name || 'Uncategorized'}\nStaff Count: ${service.staff_count}\nActive: ${service.is_active ? 'Yes' : 'No'}\n---`
          )
          .join("\n");

        const durationRange = parsedArgs.max_duration_minutes 
          ? `${parsedArgs.min_duration_minutes || 0} - ${parsedArgs.max_duration_minutes} minutes`
          : `${parsedArgs.min_duration_minutes || 0} minutes and above`;

        return {
          content: [
            {
              type: "text",
              text: `Found ${result.services.length} service(s) with duration ${durationRange}:\n\n${servicesText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting services by duration: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_services_by_staff": {
      const schema = z.object({
        staff_id: z.string().min(1, "Staff ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getServicesByStaff(parsedArgs.staff_id);

        if (!result.services || result.services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No services found for this staff member.`,
              },
            ],
          };
        }

        const staffInfo = result.staff;
        const servicesText = result.services
          .map((service: any) => 
            `ID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_formatted}\nPrice: ${service.price_formatted}\nCategory: ${service.category_name || 'Uncategorized'}\nActive: ${service.is_active ? 'Yes' : 'No'}\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Services provided by ${staffInfo.name}:\n\nContact: ${staffInfo.email} | ${staffInfo.phone}\nBio: ${staffInfo.bio || 'No bio available'}\n\nServices (${result.services.length}):\n\n${servicesText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting services by staff: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_services_by_time_availability": {
      const schema = z.object({
        date: z.string().min(1, "Date is required"),
        time: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getServicesByTimeAvailability(
          parsedArgs.date,
          parsedArgs.time
        );

        if (!result.services || result.services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No services available on ${parsedArgs.date}${parsedArgs.time ? ` at ${parsedArgs.time}` : ''}.`,
              },
            ],
          };
        }

        const servicesText = result.services
          .map((service: any) => {
            const staffList = service.available_staff && service.available_staff.length > 0
              ? service.available_staff.map((staff: any) => staff.name).join(', ')
              : 'No staff available';
            
            return `ID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: ${service.price_formatted}\nCategory: ${service.category_name || 'Uncategorized'}\nAvailable Staff: ${service.available_staff_count} (${staffList})\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Services available on ${parsedArgs.date}${parsedArgs.time ? ` at ${parsedArgs.time}` : ''}:\n\n${servicesText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting services by time availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_popular_services": {
      const schema = z.object({
        limit_count: z.number().min(1).max(50).optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const result = await getPopularServices(parsedArgs.limit_count || 10);

        if (!result.services || result.services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No popular services found.`,
              },
            ],
          };
        }

        const servicesText = result.services
          .map((service: any, index: number) => 
            `${index + 1}. ID: ${service.id}\nName: ${service.name}\nDescription: ${service.description || 'No description'}\nDuration: ${service.duration_minutes} minutes\nPrice: ${service.price_formatted}\nCategory: ${service.category_name || 'Uncategorized'}\nBookings (30 days): ${service.booking_count}\nRating: ${service.average_rating.toFixed(1)}/5 (${service.review_count} reviews)\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Top ${result.services.length} Popular Services:\n\n${servicesText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting popular services: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Customer History Tools
    case "get_customer_appointments": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
        limit: z.number().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { customer_id, limit } = parsedArgs;
        
        const appointments = await getCustomerAppointments(customer_id, limit);
        
        if (!appointments || appointments.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No appointments found for this customer.",
              },
            ],
          };
        }

        const appointmentList = appointments
          .map((apt: any) => 
            `ID: ${apt.id}\nService: ${apt.service_name}\nStaff: ${apt.staff_first_name ? `${apt.staff_first_name} ${apt.staff_last_name}` : 'Not assigned'}\nStart: ${apt.start_time}\nEnd: ${apt.end_time}\nStatus: ${apt.status}\nDuration: ${apt.duration_minutes} minutes\nPrice: $${(apt.price_cents / 100).toFixed(2)}${apt.rating ? `\nRating: ${apt.rating}/5` : ''}${apt.review_text ? `\nReview: ${apt.review_text}` : ''}\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${appointments.length} appointment(s) for customer:\n\n${appointmentList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving customer appointments: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Business Information Tools
    case "get_business_hours": {
      const schema = z.object({
      });

      try {
        
        const result = await getBusinessHours();
        
        if (!result || !result.success || !result.working_hours || result.working_hours.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No business hours found.",
              },
            ],
          };
        }

        const hoursList = result.working_hours
          .map((hour: any) => 
            `${hour.day_name}: ${hour.formatted_hours}`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Business Hours:\n\n${hoursList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving business hours: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_staff": {
      const schema = z.object({
      });

      try {
        const parsedArgs = schema.parse(args);

        
        const staff = await getStaff();
        
        if (!staff || staff.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No staff members found.",
              },
            ],
          };
        }

        const staffList = staff
          .map((member: any) => {
            const services = member.services && member.services.length > 0
              ? member.services.map((s: any) => s.name).join(', ')
              : 'No services assigned';
            
            return `ID: ${member.id}\nName: ${member.first_name} ${member.last_name}\nEmail: ${member.email || 'Not provided'}\nPhone: ${member.phone || 'Not provided'}\nBio: ${member.bio || 'No bio'}\nServices: ${services}\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${staff.length} staff member(s):\n\n${staffList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving staff: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "update_customer": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args) as any;
        const { customer_id, phone, ...updates } = parsedArgs;
        
        // Include phone in updates since database column is 'phone'
        const customerUpdates: any = { ...updates };
        if (phone !== undefined) {
          customerUpdates.phone = phone;
        }
        
        const customer = await updateCustomer(customer_id, customerUpdates);
        
        return {
          content: [
            {
              type: "text",
              text: `Customer updated successfully!\n\nID: ${customer.id}\nName: ${customer.first_name} ${customer.last_name}\nEmail: ${customer.email}\nPhone: ${customer.phone_number || 'Not provided'}\nNotes: ${customer.notes || 'No notes'}\nUpdated: ${new Date(customer.updated_at).toLocaleString()}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_customer_reviews": {
      const schema = z.object({
        customer_id: z.string().min(1, "Customer ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { customer_id } = parsedArgs;
        
        const reviews = await getCustomerReviews(customer_id);
        
        if (!reviews || reviews.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No reviews found for this customer.",
              },
            ],
          };
        }

        const reviewList = reviews
          .map((review: any) => 
            `ID: ${review.id}\nService: ${review.service_name}\nStaff: ${review.staff_first_name ? `${review.staff_first_name} ${review.staff_last_name}` : 'Not specified'}\nRating: ${review.rating}/5\nReview: ${review.review_text || 'No review text'}\nAppointment Date: ${review.start_time ? new Date(review.start_time).toLocaleDateString() : 'Not available'}\nReview Date: ${new Date(review.created_at).toLocaleDateString()}\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${reviews.length} review(s) for customer:\n\n${reviewList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving customer reviews: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "create_review": {
      const schema = z.object({
        appointment_id: z.string().min(1, "Appointment ID is required"),
        customer_id: z.string().min(1, "Customer ID is required"),
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().optional(),
        rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
        review_text: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const reviewData = parsedArgs;
        
        await ensureBusinessExists();
        const review = await createReview(reviewData);
        
        return {
          content: [
            {
              type: "text",
              text: `Review created successfully!\n\nID: ${review.id}\nAppointment ID: ${review.appointment_id}\nCustomer ID: ${review.customer_id}\nService ID: ${review.service_id}\nStaff ID: ${review.staff_id || 'Not specified'}\nRating: ${review.rating}/5\nReview: ${review.review_text || 'No review text'}\nCreated: ${new Date(review.created_at).toLocaleString()}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating review: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Availability and Staff Management Tools
    case "get_staff_availability": {
      const schema = z.object({
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { date } = parsedArgs;
        
        if (!isValidDate(date)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid date format. Please use YYYY-MM-DD format.",
              },
            ],
            isError: true,
          };
        }
        
        const availability = await getStaffAvailability(date);
        
        if (!availability || availability.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No staff availability found for this date.",
              },
            ],
          };
        }

        const availabilityList = availability
          .map((staff: any) => {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = staff.day_of_week !== null ? dayNames[staff.day_of_week] : 'No schedule';
            const workingHours = staff.open_time && staff.close_time ? `${staff.open_time} - ${staff.close_time}` : 'Not available';
            const timeOffInfo = staff.has_time_off ? 
              `\nTime Off: ${staff.time_off_title || 'Scheduled time off'}${staff.time_off_all_day ? ' (All day)' : staff.time_off_start ? ` (${staff.time_off_start} - ${staff.time_off_end})` : ''}` : '';
            
            return `Name: ${staff.first_name} ${staff.last_name}\nEmail: ${staff.email}\nPhone: ${staff.phone_number}\nDay: ${dayName}\nWorking Hours: ${workingHours}\nAvailable: ${staff.is_available ? 'Yes' : 'No'}${timeOffInfo}\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Staff Availability for ${date}:\n\n${availabilityList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting staff availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_available_time_slots": {
      const schema = z.object({
        service_id: z.string().min(1, "Service ID is required"),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { service_id, date } = parsedArgs;
        
        if (!isValidDate(date)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid date format. Please use YYYY-MM-DD format.",
              },
            ],
            isError: true,
          };
        }
        
        const timeSlots = await getAvailableTimeSlots(service_id, date);
        
        if (!timeSlots || timeSlots.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No available time slots found for this service and date.",
              },
            ],
          };
        }

        const slotsList = timeSlots
          .map((slot: any) => {
            const staffList = slot.available_staff.map((staff: any) => staff.name).join(', ');
            return `Time: ${slot.start_time} - ${slot.end_time}\nAvailable Staff: ${staffList}\nAvailable Slots: ${slot.available_slots}\n---`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Available Time Slots for ${date}:\n\n${slotsList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting available time slots: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_all_staff_info": {
      const schema = z.object({
      });

      try {
        const parsedArgs = schema.parse(args);

        
        const staffInfo = await getAllStaffInfo();
        
        if (!staffInfo || staffInfo.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No staff members found.",
              },
            ],
          };
        }

        const staffList = staffInfo
          .map((staff: any) => 
            `ID: ${staff.staff_id}\nName: ${staff.first_name} ${staff.last_name}\nEmail: ${staff.email}\nPhone: ${staff.phone_number}\nBio: ${staff.bio || 'No bio'}\nServices: ${staff.services_provided || 'No services assigned'}\nTotal Services: ${staff.total_services}\nWorking Hours: ${staff.working_hours_summary || 'No working hours set'}\nUpcoming Appointments: ${staff.upcoming_appointments}\nCompleted Appointments: ${staff.completed_appointments}\nActive: ${staff.is_active ? 'Yes' : 'No'}\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Staff Information:\n\n${staffList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting staff information: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_staff_member": {
      const schema = z.object({
        staff_id: z.string().min(1, "Staff ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { staff_id } = parsedArgs;
        
        const staff = await getStaffMember(staff_id);
        
        const servicesList = staff.services && staff.services.length > 0 
          ? staff.services.map((service: any) => `${service.name} (${service.duration_minutes} min, $${(service.price_cents / 100).toFixed(2)})`).join(', ')
          : 'No services assigned';
        
        const workingHoursList = staff.working_hours && staff.working_hours.length > 0
          ? staff.working_hours.map((hour: any) => `${hour.day_name}: ${hour.open_time} - ${hour.close_time} (${hour.is_available ? 'Available' : 'Not Available'})`).join('\n')
          : 'No working hours set';
        
        return {
          content: [
            {
              type: "text",
              text: `Staff Member Details:\n\nID: ${staff.staff_id}\nName: ${staff.first_name} ${staff.last_name}\nEmail: ${staff.email}\nPhone: ${staff.phone_number}\nBio: ${staff.bio || 'No bio'}\nAvatar: ${staff.avatar_url || 'No avatar'}\nActive: ${staff.is_active ? 'Yes' : 'No'}\n\nServices Provided:\n${servicesList}\n\nWorking Hours:\n${workingHoursList}\n\nAppointments:\nUpcoming: ${staff.upcoming_appointments}\nCompleted: ${staff.completed_appointments}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting staff member: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_staff_time_off": {
      const schema = z.object({
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { start_date, end_date } = parsedArgs;
        
        if (start_date && !isValidDate(start_date)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid start date format. Please use YYYY-MM-DD format.",
              },
            ],
            isError: true,
          };
        }
        
        if (end_date && !isValidDate(end_date)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid end date format. Please use YYYY-MM-DD format.",
              },
            ],
            isError: true,
          };
        }
        
        const timeOff = await getStaffTimeOff(start_date, end_date);
        
        if (!timeOff || timeOff.length === 0) {
          const dateRange = start_date && end_date ? ` between ${start_date} and ${end_date}` : start_date ? ` from ${start_date}` : '';
          return {
            content: [
              {
                type: "text",
                text: `No staff time off found${dateRange}.`,
              },
            ],
          };
        }

        const timeOffList = timeOff
          .map((item: any) => 
            `ID: ${item.id}\nStaff: ${item.first_name} ${item.last_name}\nTitle: ${item.title || 'No title'}\nDescription: ${item.description || 'No description'}\nDate: ${item.date}\nTime: ${item.is_all_day ? 'All day' : `${item.start_time} - ${item.end_time}`}\nCreated: ${new Date(item.created_at).toLocaleDateString()}\n---`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Staff Time Off:\n\n${timeOffList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting staff time off: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    // New Availability Checking Tools
    case "check_service_availability": {
      const schema = z.object({
        service_name: z.string().min(1, "Service name is required"),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
        time: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { service_name, date, time } = parsedArgs;
        
        if (!isValidDate(date)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid date format. Please use YYYY-MM-DD format.",
              },
            ],
            isError: true,
          };
        }
        
        const availability = await checkServiceAvailability(service_name, date, time);
        
        if (!availability.available) {
          return {
            content: [
              {
                type: "text",
                text: `❌ ${availability.reason}`,
              },
            ],
          };
        }

        const staffList = availability.staff
          .map((staff: any) => 
            `• ${staff.first_name} ${staff.last_name} (${staff.open_time} - ${staff.close_time})`
          )
          .join("\n");

        const timeInfo = time ? ` at ${time}` : "";
        const slotInfo = availability.remainingSlots ? `\n\n📊 Booking Status:\n• Total Slots: ${availability.maxBookings}\n• Booked: ${availability.existingAppointments}\n• Available: ${availability.remainingSlots}` : "";
        
        return {
          content: [
            {
              type: "text",
              text: `✅ ${availability.reason}${timeInfo}\n\nAvailable Staff:\n${staffList}${slotInfo}\n\nService: ${availability.service.name}\nDuration: ${availability.service.duration_minutes} minutes`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking service availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "get_service_time_slots": {
      const schema = z.object({
        service_name: z.string().min(1, "Service name is required"),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { service_name, date } = parsedArgs;
        
        if (!isValidDate(date)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid date format. Please use YYYY-MM-DD format.",
              },
            ],
            isError: true,
          };
        }
        
        const result = await getServiceTimeSlots(service_name, date);
        
        if (!result.available) {
          return {
            content: [
              {
                type: "text",
                text: `❌ ${result.reason}`,
              },
            ],
          };
        }

        const slotsList = result.timeSlots
          .map((slot: any) => 
            `• ${slot.start_time} - ${slot.end_time} (${slot.staff_name})\n  📊 Slots: ${slot.remaining_slots}/${slot.total_slots} available`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `✅ ${result.reason}\n\nAvailable Time Slots:\n${slotsList}\n\nService: ${result.service.name}\nDuration: ${result.service.duration_minutes} minutes`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting service time slots: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "check_business_hours": {
      const schema = z.object({
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const { date } = parsedArgs;
        
        if (!isValidDate(date)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid date format. Please use YYYY-MM-DD format.",
              },
            ],
            isError: true,
          };
        }
        
        const hours = await checkBusinessHours(date);
        
        if (!hours.isOpen) {
          return {
            content: [
              {
                type: "text",
                text: `❌ ${hours.reason}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ ${hours.reason}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking business hours: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "check_appointment_conflict": {
      const schema = z.object({
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().min(1, "Staff ID is required"),
        customer_id: z.string().min(1, "Customer ID is required"),
        start_time: z.string().min(1, "Start time is required (ISO format)"),
        end_time: z.string().min(1, "End time is required (ISO format)"),
        appointment_id: z.string().optional(), // Optional: exclude current appointment when updating
      });

      try {
        const parsedArgs = schema.parse(args);
        const { service_id, staff_id, customer_id, start_time, end_time, appointment_id } = parsedArgs;
        
        // Validate ISO datetime format
        if (!isValidDate(start_time.split('T')[0]) || !isValidDate(end_time.split('T')[0])) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Invalid date format. Please use ISO format (YYYY-MM-DDTHH:MM:SS).",
              },
            ],
            isError: true,
          };
        }

        const result = await checkAppointmentConflict(service_id, staff_id, customer_id, start_time, end_time, appointment_id);

        if (result.hasConflicts) {
          const errorConflicts = result.conflicts.filter((c: any) => c.severity === 'ERROR');
          const warningConflicts = result.conflicts.filter((c: any) => c.severity === 'WARNING');
          
          let responseText = `❌ Appointment conflicts detected!\n\n`;
          
          if (errorConflicts.length > 0) {
            responseText += `🚨 ERRORS (${errorConflicts.length}):\n`;
            errorConflicts.forEach((conflict: any, index: number) => {
              responseText += `${index + 1}. ${conflict.message}\n`;
            });
            responseText += '\n';
          }
          
          if (warningConflicts.length > 0) {
            responseText += `⚠️ WARNINGS (${warningConflicts.length}):\n`;
            warningConflicts.forEach((conflict: any, index: number) => {
              responseText += `${index + 1}. ${conflict.message}\n`;
            });
            responseText += '\n';
          }
          
          responseText += `📊 Summary:\n`;
          responseText += `• Total Conflicts: ${result.summary?.totalConflicts || 0}\n`;
          responseText += `• Errors: ${result.summary?.errorCount || 0}\n`;
          responseText += `• Warnings: ${result.summary?.warningCount || 0}\n`;
          responseText += `• Can Proceed: ${result.summary?.canProceed ? 'Yes' : 'No'}`;

          return {
            content: [
              {
                type: "text",
                text: responseText,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `✅ No conflicts detected! The appointment is available.\n\n📊 Summary:\n• Total Conflicts: 0\n• Errors: 0\n• Warnings: 0\n• Can Proceed: Yes`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking appointment conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            customer_id: {
              type: "string",
              description: "The customer ID",
            },
            service_id: {
              type: "string",
              description: "The service ID",
            },
            staff_id: {
              type: "string",
              description: "The staff member ID (optional)",
            },
            start_time: {
              type: "string",
              description: "Start time in ISO format (e.g., 2024-01-15T10:00:00Z)",
            },
            end_time: {
              type: "string",
              description: "End time in ISO format (e.g., 2024-01-15T11:00:00Z)",
            },
            notes: {
              type: "string",
              description: "Optional notes for the appointment",
            },
          },
          required: ["customer_id", "service_id", "start_time", "end_time"],
        },
      },
      {
        name: "list_appointments",
        description: "List appointments with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            customer_id: {
              type: "string",
              description: "Filter by customer ID (optional)",
            },
            service_id: {
              type: "string",
              description: "Filter by service ID (optional)",
            },
            staff_id: {
              type: "string",
              description: "Filter by staff ID (optional)",
            },
            status: {
              type: "string",
              description: "Filter by status (optional)",
            },
            start_date: {
              type: "string",
              description: "Filter appointments from this date (optional)",
            },
            end_date: {
              type: "string",
              description: "Filter appointments until this date (optional)",
            },
          },
          required: [],
        },
      },
      {
        name: "get_appointment",
        description: "Get a specific appointment by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The appointment ID",
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
              description: "The appointment ID to delete",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_business",
        description: "Get business details",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "create_customer",
        description: "Create a new customer",
        inputSchema: {
          type: "object",
          properties: {
            first_name: {
              type: "string",
              description: "Customer's first name",
            },
            last_name: {
              type: "string",
              description: "Customer's last name",
            },
            email: {
              type: "string",
              description: "Customer's email address",
            },
            phone: {
              type: "string",
              description: "Customer's phone number (optional)",
            },
            notes: {
              type: "string",
              description: "Additional notes about the customer (optional)",
            },
          },
          required: ["phone"],
        },
      },
      {
        name: "get_customer",
        description: "Get customer details by ID",
        inputSchema: {
          type: "object",
          properties: {
            customer_id: {
              type: "string",
              description: "The customer ID",
            },
          },
          required: ["customer_id"],
        },
      },
      {
        name: "search_customers",
        description: "Search customers by name, email, or phone",
        inputSchema: {
          type: "object",
          properties: {
            search_term: {
              type: "string",
              description: "Search term to match against customer name, email, or phone",
            },
          },
          required: ["search_term"],
        },
      },
      {
        name: "get_services",
        description: "Get all available services",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_service",
        description: "Get detailed information about a specific service",
        inputSchema: {
          type: "object",
          properties: {
            service_id: {
              type: "string",
              description: "The service ID",
            },
          },
          required: ["service_id"],
        },
      },
      {
        name: "get_service_by_name",
        description: "Search for services by name (supports partial matching)",
        inputSchema: {
          type: "object",
          properties: {
            service_name: {
              type: "string",
              description: "The service name to search for (supports partial matching)",
            },
          },
          required: ["service_name"],
        },
      },
      {
        name: "search_services_fuzzy",
        description: "Search for services with fuzzy matching to handle typos and similar names",
        inputSchema: {
          type: "object",
          properties: {
            service_name: {
              type: "string",
              description: "The service name to search for (handles typos and similar names)",
            },
            similarity_threshold: {
              type: "number",
              description: "Similarity threshold (0.0 to 1.0, default 0.3). Higher values require more exact matches.",
            },
          },
          required: ["service_name"],
        },
      },
      {
        name: "search_services_comprehensive",
        description: "Comprehensive service search that searches both names and descriptions with fuzzy matching",
        inputSchema: {
          type: "object",
          properties: {
            search_term: {
              type: "string",
              description: "The search term to look for in service names and descriptions",
            },
            similarity_threshold: {
              type: "number",
              description: "Similarity threshold (0.0 to 1.0, default 0.3). Higher values require more exact matches.",
            },
          },
          required: ["search_term"],
        },
      },
      {
        name: "get_customer_appointments",
        description: "Get appointment history for a specific customer",
        inputSchema: {
          type: "object",
          properties: {
            customer_id: {
              type: "string",
              description: "The customer ID",
            },
            limit: {
              type: "number",
              description: "Maximum number of appointments to return (optional)",
            },
          },
          required: ["customer_id"],
        },
      },
      {
        name: "get_business_hours",
        description: "Get business operating hours",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
                  {
              name: "get_staff",
              description: "Get information about staff members",
              inputSchema: {
                type: "object",
                properties: {},
                required: [],
              },
            },
            {
              name: "update_customer",
              description: "Update an existing customer",
              inputSchema: {
                type: "object",
                properties: {
                  customer_id: {
                    type: "string",
                    description: "The customer ID",
                  },
                  first_name: {
                    type: "string",
                    description: "Customer's first name (optional)",
                  },
                  last_name: {
                    type: "string",
                    description: "Customer's last name (optional)",
                  },
                  email: {
                    type: "string",
                    description: "Customer's email address (optional)",
                  },
                  phone: {
                    type: "string",
                    description: "Customer's phone number",
                  },
                  notes: {
                    type: "string",
                    description: "Additional notes about the customer (optional)",
                  },
                },
                required: ["customer_id", "phone"],
              },
            },
            {
              name: "get_customer_reviews",
              description: "Get reviews for a specific customer",
              inputSchema: {
                type: "object",
                properties: {
                  customer_id: {
                    type: "string",
                    description: "The customer ID",
                  },
                },
                required: ["customer_id"],
              },
            },
            {
              name: "create_review",
              description: "Create a new review for an appointment",
              inputSchema: {
                type: "object",
                properties: {
                  appointment_id: {
                    type: "string",
                    description: "The appointment ID",
                  },
                  customer_id: {
                    type: "string",
                    description: "The customer ID",
                  },
                  service_id: {
                    type: "string",
                    description: "The service ID",
                  },
                  staff_id: {
                    type: "string",
                    description: "The staff member ID (optional)",
                  },
                  rating: {
                    type: "number",
                    description: "Rating from 1 to 5",
                  },
                  review_text: {
                    type: "string",
                    description: "Review text (optional)",
                  },
                },
                required: ["appointment_id", "customer_id", "service_id", "rating"],
              },
            },
            {
              name: "get_staff_availability",
              description: "Get staff availability for a specific date",
              inputSchema: {
                type: "object",
                properties: {
                  date: {
                    type: "string",
                    description: "The date to check availability (YYYY-MM-DD format)",
                  },
                },
                required: ["date"],
              },
            },
            {
              name: "get_available_time_slots",
              description: "Get available time slots for a specific service on a date",
              inputSchema: {
                type: "object",
                properties: {
                  service_id: {
                    type: "string",
                    description: "The service ID",
                  },
                  date: {
                    type: "string",
                    description: "The date to check availability (YYYY-MM-DD format)",
                  },
                },
                required: ["service_id", "date"],
              },
            },
            {
              name: "get_all_staff_info",
              description: "Get detailed information about all staff members",
              inputSchema: {
                type: "object",
                properties: {},
                required: [],
              },
            },
            {
              name: "get_staff_member",
              description: "Get detailed information about a specific staff member",
              inputSchema: {
                type: "object",
                properties: {
                  staff_id: {
                    type: "string",
                    description: "The staff member ID",
                  },
                },
                required: ["staff_id"],
              },
            },
            {
              name: "get_staff_time_off",
              description: "Get staff time off for a specific date range",
              inputSchema: {
                type: "object",
                properties: {
                  start_date: {
                    type: "string",
                    description: "Start date for time off (YYYY-MM-DD format, optional)",
                  },
                  end_date: {
                    type: "string",
                    description: "End date for time off (YYYY-MM-DD format, optional)",
                  },
                },
                required: [],
              },
            },
            {
              name: "check_service_availability",
              description: "Check if a service is available on a specific date and time",
              inputSchema: {
                type: "object",
                properties: {
                  service_name: {
                    type: "string",
                    description: "The name of the service",
                  },
                  date: {
                    type: "string",
                    description: "The date to check availability (YYYY-MM-DD format)",
                  },
                  time: {
                    type: "string",
                    description: "The specific time to check (optional, HH:MM format)",
                  },
                },
                required: ["service_name", "date"],
              },
            },
            {
              name: "get_service_time_slots",
              description: "Get available time slots for a specific service on a date",
              inputSchema: {
                type: "object",
                properties: {
                  service_name: {
                    type: "string",
                    description: "The name of the service",
                  },
                  date: {
                    type: "string",
                    description: "The date to check availability (YYYY-MM-DD format)",
                  },
                },
                required: ["service_name", "date"],
              },
            },
            {
              name: "check_business_hours",
              description: "Check if the business is open on a specific date",
              inputSchema: {
                type: "object",
                properties: {
                  date: {
                    type: "string",
                    description: "The date to check business hours (YYYY-MM-DD format)",
                  },
                },
                required: ["date"],
              },
            },
            {
              name: "check_appointment_conflict",
              description: "Comprehensive appointment conflict checking for double-booking, staff availability, business hours, and more",
              inputSchema: {
                type: "object",
                properties: {
                  service_id: {
                    type: "string",
                    description: "The service ID",
                  },
                  staff_id: {
                    type: "string",
                    description: "The staff member ID",
                  },
                  customer_id: {
                    type: "string",
                    description: "The customer ID",
                  },
                  start_time: {
                    type: "string",
                    description: "The appointment start time (ISO format: YYYY-MM-DDTHH:MM:SS)",
                  },
                  end_time: {
                    type: "string",
                    description: "The appointment end time (ISO format: YYYY-MM-DDTHH:MM:SS)",
                  },
                  appointment_id: {
                    type: "string",
                    description: "Optional: exclude current appointment when updating existing appointment",
                  },
                },
                required: ["service_id", "staff_id", "customer_id", "start_time", "end_time"],
              },
            },
            // Customer-Focused Appointment Management Tools
            {
              name: "update_appointment",
              description: "Update an existing appointment with new details",
              inputSchema: {
                type: "object",
                properties: {
                  appointment_id: {
                    type: "string",
                    description: "The appointment ID to update",
                  },
                  customer_id: {
                    type: "string",
                    description: "The customer ID",
                  },
                  service_id: {
                    type: "string",
                    description: "The service ID",
                  },
                  staff_id: {
                    type: "string",
                    description: "The staff member ID",
                  },
                  start_time: {
                    type: "string",
                    description: "New start time (ISO format: YYYY-MM-DDTHH:MM:SS)",
                  },
                  end_time: {
                    type: "string",
                    description: "New end time (ISO format: YYYY-MM-DDTHH:MM:SS)",
                  },
                  status: {
                    type: "string",
                    description: "New appointment status (scheduled, confirmed, completed, cancelled)",
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes for the appointment",
                  },
                },
                required: ["appointment_id", "customer_id", "service_id", "staff_id", "start_time", "end_time", "status"],
              },
            },
            {
              name: "cancel_appointment",
              description: "Cancel an appointment with a reason",
              inputSchema: {
                type: "object",
                properties: {
                  appointment_id: {
                    type: "string",
                    description: "The appointment ID to cancel",
                  },
                  cancellation_reason: {
                    type: "string",
                    description: "Reason for cancellation",
                  },
                  cancelled_by: {
                    type: "string",
                    description: "Who is cancelling the appointment (customer ID or staff ID)",
                  },
                },
                required: ["appointment_id", "cancellation_reason", "cancelled_by"],
              },
            },
            {
              name: "reschedule_appointment",
              description: "Reschedule an appointment to a new time",
              inputSchema: {
                type: "object",
                properties: {
                  appointment_id: {
                    type: "string",
                    description: "The appointment ID to reschedule",
                  },
                  new_start_time: {
                    type: "string",
                    description: "New start time (ISO format: YYYY-MM-DDTHH:MM:SS)",
                  },
                  new_end_time: {
                    type: "string",
                    description: "New end time (ISO format: YYYY-MM-DDTHH:MM:SS)",
                  },
                  rescheduled_by: {
                    type: "string",
                    description: "Who is rescheduling the appointment (customer ID or staff ID)",
                  },
                },
                required: ["appointment_id", "new_start_time", "new_end_time", "rescheduled_by"],
              },
            },
            {
              name: "confirm_appointment",
              description: "Confirm an appointment",
              inputSchema: {
                type: "object",
                properties: {
                  appointment_id: {
                    type: "string",
                    description: "The appointment ID to confirm",
                  },
                  confirmed_by: {
                    type: "string",
                    description: "Who is confirming the appointment (customer ID or staff ID)",
                  },
                },
                required: ["appointment_id", "confirmed_by"],
              },
            },
            {
              name: "complete_appointment",
              description: "Mark an appointment as completed",
              inputSchema: {
                type: "object",
                properties: {
                  appointment_id: {
                    type: "string",
                    description: "The appointment ID to complete",
                  },
                  completed_by: {
                    type: "string",
                    description: "Who is completing the appointment (staff ID)",
                  },
                  completion_notes: {
                    type: "string",
                    description: "Optional notes about the completion",
                  },
                },
                required: ["appointment_id", "completed_by"],
              },
            },
            {
              name: "check_real_time_availability",
              description: "Check real-time availability for a service at a specific date and time",
              inputSchema: {
                type: "object",
                properties: {
                  service_id: {
                    type: "string",
                    description: "The service ID to check availability for",
                  },
                  date: {
                    type: "string",
                    description: "The date to check (YYYY-MM-DD format)",
                  },
                  time: {
                    type: "string",
                    description: "The specific time to check (HH:MM format)",
                  },
                },
                required: ["service_id", "date", "time"],
              },
            },
            {
              name: "get_staff_availability_calendar",
              description: "Get a detailed availability calendar for a staff member",
              inputSchema: {
                type: "object",
                properties: {
                  staff_id: {
                    type: "string",
                    description: "The staff member ID",
                  },
                  start_date: {
                    type: "string",
                    description: "Start date for calendar (YYYY-MM-DD format)",
                  },
                  end_date: {
                    type: "string",
                    description: "End date for calendar (YYYY-MM-DD format)",
                  },
                },
                required: ["staff_id", "start_date", "end_date"],
              },
            },
            // Phase 2 Customer-Focused Tool Definitions
            {
              name: "create_customer_validated",
              description: "Create a new customer with comprehensive validation (email format, phone validation, duplicate checking)",
              inputSchema: {
                type: "object",
                properties: {
                  first_name: {
                    type: "string",
                    description: "Customer's first name",
                  },
                  last_name: {
                    type: "string",
                    description: "Customer's last name",
                  },
                  email: {
                    type: "string",
                    description: "Customer's email address (validated format)",
                  },
                  phone: {
                    type: "string",
                    description: "Customer's phone number (minimum 10 digits)",
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes about the customer",
                  },
                },
                required: ["first_name", "last_name", "email", "phone"],
              },
            },
            {
              name: "update_customer_profile",
              description: "Update customer profile with validation (email format, phone validation, duplicate checking)",
              inputSchema: {
                type: "object",
                properties: {
                  customer_id: {
                    type: "string",
                    description: "The customer ID to update",
                  },
                  first_name: {
                    type: "string",
                    description: "Customer's first name",
                  },
                  last_name: {
                    type: "string",
                    description: "Customer's last name",
                  },
                  email: {
                    type: "string",
                    description: "Customer's email address (validated format)",
                  },
                  phone: {
                    type: "string",
                    description: "Customer's phone number (minimum 10 digits)",
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes about the customer",
                  },
                },
                required: ["customer_id", "first_name", "last_name", "email", "phone"],
              },
            },
            {
              name: "get_customer_preferences",
              description: "Get customer preferences based on booking history (preferred services, staff, time slots)",
              inputSchema: {
                type: "object",
                properties: {
                  customer_id: {
                    type: "string",
                    description: "The customer ID to get preferences for",
                  },
                },
                required: ["customer_id"],
              },
            },
            {
              name: "get_customer_statistics",
              description: "Get comprehensive customer statistics (appointments, spending, loyalty metrics)",
              inputSchema: {
                type: "object",
                properties: {
                  customer_id: {
                    type: "string",
                    description: "The customer ID to get statistics for",
                  },
                },
                required: ["customer_id"],
              },
            },
            {
              name: "create_booking_validated",
              description: "Create a booking with comprehensive validation (conflict checking, availability verification)",
              inputSchema: {
                type: "object",
                properties: {
                  customer_id: {
                    type: "string",
                    description: "The customer ID",
                  },
                  service_id: {
                    type: "string",
                    description: "The service ID",
                  },
                  staff_id: {
                    type: "string",
                    description: "The staff member ID",
                  },
                  start_time: {
                    type: "string",
                    description: "Start time (ISO format: YYYY-MM-DDTHH:MM:SS)",
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes for the booking",
                  },
                },
                required: ["customer_id", "service_id", "staff_id", "start_time"],
              },
            },
            {
              name: "get_booking_confirmation",
              description: "Get detailed booking confirmation with all relevant information",
              inputSchema: {
                type: "object",
                properties: {
                  appointment_id: {
                    type: "string",
                    description: "The appointment ID to get confirmation for",
                  },
                },
                required: ["appointment_id"],
              },
            },
            {
              name: "get_available_booking_slots",
              description: "Get available booking slots for a service on a specific date",
              inputSchema: {
                type: "object",
                properties: {
                  service_id: {
                    type: "string",
                    description: "The service ID to check availability for",
                  },
                  date: {
                    type: "string",
                    description: "The date to check (YYYY-MM-DD format)",
                  },
                  staff_id: {
                    type: "string",
                    description: "Optional: filter by specific staff member",
                  },
                },
                required: ["service_id", "date"],
              },
            },
            // Additional Customer-Focused Service Discovery Tool Definitions
            {
              name: "get_services_by_price_range",
              description: "Get services filtered by price range (useful for customers with budget constraints)",
              inputSchema: {
                type: "object",
                properties: {
                  min_price_cents: {
                    type: "number",
                    description: "Minimum price in cents (optional, default 0)",
                  },
                  max_price_cents: {
                    type: "number",
                    description: "Maximum price in cents (optional, no upper limit if not specified)",
                  },
                },
                required: [],
              },
            },
            {
              name: "get_services_by_duration",
              description: "Get services filtered by duration range (useful for customers with time constraints)",
              inputSchema: {
                type: "object",
                properties: {
                  min_duration_minutes: {
                    type: "number",
                    description: "Minimum duration in minutes (optional, default 0)",
                  },
                  max_duration_minutes: {
                    type: "number",
                    description: "Maximum duration in minutes (optional, no upper limit if not specified)",
                  },
                },
                required: [],
              },
            },
            {
              name: "get_services_by_staff",
              description: "Get all services provided by a specific staff member",
              inputSchema: {
                type: "object",
                properties: {
                  staff_id: {
                    type: "string",
                    description: "The staff member ID to get services for",
                  },
                },
                required: ["staff_id"],
              },
            },
            {
              name: "get_services_by_time_availability",
              description: "Get services that are available at a specific date and time",
              inputSchema: {
                type: "object",
                properties: {
                  date: {
                    type: "string",
                    description: "The date to check availability (YYYY-MM-DD format)",
                  },
                  time: {
                    type: "string",
                    description: "The specific time to check (optional, HH:MM format)",
                  },
                },
                required: ["date"],
              },
            },
            {
              name: "get_popular_services",
              description: "Get the most popular services based on booking count and ratings",
              inputSchema: {
                type: "object",
                properties: {
                  limit_count: {
                    type: "number",
                    description: "Maximum number of services to return (optional, default 10, max 50)",
                  },
                },
                required: [],
              },
            },
    ],
  };
});

// Start the server
async function main() {
  try {
    // Verify database connection on startup
    await verifyDatabaseConnection();
    console.log('Database connection verified successfully');
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('Appointment MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();