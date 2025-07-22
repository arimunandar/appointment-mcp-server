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
  checkAppointmentConflict
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
        business_id: z.string().optional(),
        customer_id: z.string().min(1, "Customer ID is required"),
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().optional(),
        start_time: z.string().min(1, "Start time is required"),
        end_time: z.string().min(1, "End time is required"),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const appointmentData = { ...parsedArgs, business_id };
        
        // Ensure business exists
        await ensureBusinessExists(business_id);
        
        const appointment = await createAppointment(business_id, appointmentData);
        
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
        business_id: z.string().optional(),
        customer_id: z.string().optional(),
        service_id: z.string().optional(),
        staff_id: z.string().optional(),
        status: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { business_id: _, ...filters } = parsedArgs;
        
        const appointments = await getAppointments(business_id, filters);

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
        business_id: z.string().optional(),
        id: z.string().min(1, "Appointment ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { id } = parsedArgs;
        
        const appointment = await getAppointment(business_id, id);

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
        business_id: z.string().optional(),
        id: z.string().min(1, "Appointment ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { id } = parsedArgs;
        
        const deletedAppointment = await deleteAppointment(business_id, id);

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
        business_id: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        
        const business = await getBusinessDetails(business_id);
        
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
        business_id: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string(),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { business_id: _, ...customerData } = parsedArgs;
        
        await ensureBusinessExists(business_id);
        const customer = await createCustomer(business_id, customerData);
        
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
        business_id: z.string().optional(),
        customer_id: z.string().min(1, "Customer ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { customer_id } = parsedArgs;
        
        const customer = await getCustomer(business_id, customer_id);
        
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
        business_id: z.string().optional(),
        search_term: z.string().min(1, "Search term is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { search_term } = parsedArgs;
        
        const customers = await searchCustomers(business_id, search_term);
        
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
        business_id: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        
        const services = await getServices(business_id);
        
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
        business_id: z.string().optional(),
        service_id: z.string().min(1, "Service ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { service_id } = parsedArgs;
        
        const service = await getService(business_id, service_id);
        
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

    // Customer History Tools
    case "get_customer_appointments": {
      const schema = z.object({
        business_id: z.string().optional(),
        customer_id: z.string().min(1, "Customer ID is required"),
        limit: z.number().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { customer_id, limit } = parsedArgs;
        
        const appointments = await getCustomerAppointments(business_id, customer_id, limit);
        
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
        business_id: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        
        const hours = await getBusinessHours(business_id);
        
        if (!hours || hours.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No business hours found.",
              },
            ],
          };
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const hoursList = hours
          .map((hour: any) => 
            `${dayNames[hour.day_of_week]}: ${hour.is_open ? `${hour.open_time} - ${hour.close_time}` : 'Closed'}`
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
        business_id: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        
        const staff = await getStaff(business_id);
        
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
        business_id: z.string().optional(),
        customer_id: z.string().min(1, "Customer ID is required"),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args) as any;
        const business_id = getBusinessId(parsedArgs.business_id);
        const { business_id: _, customer_id, phone, ...updates } = parsedArgs;
        
        // Include phone in updates since database column is 'phone'
        const customerUpdates: any = { ...updates };
        if (phone !== undefined) {
          customerUpdates.phone = phone;
        }
        
        const customer = await updateCustomer(business_id, customer_id, customerUpdates);
        
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
        business_id: z.string().optional(),
        customer_id: z.string().min(1, "Customer ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { customer_id } = parsedArgs;
        
        const reviews = await getCustomerReviews(business_id, customer_id);
        
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
        business_id: z.string().optional(),
        appointment_id: z.string().min(1, "Appointment ID is required"),
        customer_id: z.string().min(1, "Customer ID is required"),
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().optional(),
        rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
        review_text: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { business_id: _, ...reviewData } = parsedArgs;
        
        await ensureBusinessExists(business_id);
        const review = await createReview(business_id, reviewData);
        
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
        business_id: z.string().optional(),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
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
        
        const availability = await getStaffAvailability(business_id, date);
        
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
        business_id: z.string().optional(),
        service_id: z.string().min(1, "Service ID is required"),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
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
        
        const timeSlots = await getAvailableTimeSlots(business_id, service_id, date);
        
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
          .map((slot: any) => 
            `Staff: ${slot.first_name} ${slot.last_name}\nService: ${slot.service_name}\nTime: ${slot.slot_start_time} - ${slot.slot_end_time}\nDuration: ${slot.duration_minutes} minutes\nStatus: ${slot.availability_status}\nExisting Appointments: ${slot.existing_appointments}/${slot.max_bookings_per_slot}\n---`
          )
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
        business_id: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        
        const staffInfo = await getAllStaffInfo(business_id);
        
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
        business_id: z.string().optional(),
        staff_id: z.string().min(1, "Staff ID is required"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
        const { staff_id } = parsedArgs;
        
        const staff = await getStaffMember(business_id, staff_id);
        
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
        business_id: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
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
        
        const timeOff = await getStaffTimeOff(business_id, start_date, end_date);
        
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
        business_id: z.string().optional(),
        service_name: z.string().min(1, "Service name is required"),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
        time: z.string().optional(),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
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
        
        const availability = await checkServiceAvailability(business_id, service_name, date, time);
        
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
        business_id: z.string().optional(),
        service_name: z.string().min(1, "Service name is required"),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
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
        
        const result = await getServiceTimeSlots(business_id, service_name, date);
        
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
        business_id: z.string().optional(),
        date: z.string().min(1, "Date is required (YYYY-MM-DD format)"),
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
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
        
        const hours = await checkBusinessHours(business_id, date);
        
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
        business_id: z.string().optional(),
        service_id: z.string().min(1, "Service ID is required"),
        staff_id: z.string().min(1, "Staff ID is required"),
        customer_id: z.string().min(1, "Customer ID is required"),
        start_time: z.string().min(1, "Start time is required (ISO format)"),
        end_time: z.string().min(1, "End time is required (ISO format)"),
        appointment_id: z.string().optional(), // Optional: exclude current appointment when updating
      });

      try {
        const parsedArgs = schema.parse(args);
        const business_id = getBusinessId(parsedArgs.business_id);
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

        const result = await checkAppointmentConflict(business_id, service_id, staff_id, customer_id, start_time, end_time, appointment_id);

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
            business_id: {
              type: "string",
              description: "The business ID",
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
            business_id: {
              type: "string",
              description: "The business ID",
            },
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
            business_id: {
              type: "string",
              description: "The business ID",
            },
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
            business_id: {
              type: "string",
              description: "The business ID",
            },
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
        description: "Get business details by business ID",
        inputSchema: {
          type: "object",
          properties: {
            business_id: {
              type: "string",
              description: "The business ID",
            },
          },
          required: [],
        },
      },
      {
        name: "create_customer",
        description: "Create a new customer",
        inputSchema: {
          type: "object",
          properties: {
            business_id: {
              type: "string",
              description: "The business ID",
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
            business_id: {
              type: "string",
              description: "The business ID",
            },
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
            business_id: {
              type: "string",
              description: "The business ID",
            },
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
          properties: {
            business_id: {
              type: "string",
              description: "The business ID",
            },
          },
          required: [],
        },
      },
      {
        name: "get_service",
        description: "Get detailed information about a specific service",
        inputSchema: {
          type: "object",
          properties: {
            business_id: {
              type: "string",
              description: "The business ID",
            },
            service_id: {
              type: "string",
              description: "The service ID",
            },
          },
          required: ["service_id"],
        },
      },
      {
        name: "get_customer_appointments",
        description: "Get appointment history for a specific customer",
        inputSchema: {
          type: "object",
          properties: {
            business_id: {
              type: "string",
              description: "The business ID",
            },
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
          properties: {
            business_id: {
              type: "string",
              description: "The business ID",
            },
          },
          required: ["business_id"],
        },
      },
      {
              name: "get_staff",
              description: "Get information about staff members",
              inputSchema: {
                type: "object",
                properties: {
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
                },
                required: [],
              },
            },
            {
              name: "update_customer",
              description: "Update an existing customer",
              inputSchema: {
                type: "object",
                properties: {
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
                  customer_id: {
                    type: "string",
                    description: "The customer ID",
                  },
                },
                required: ["business_id", "customer_id"],
              },
            },
            {
              name: "create_review",
              description: "Create a new review for an appointment",
              inputSchema: {
                type: "object",
                properties: {
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                properties: {
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
                },
                required: [],
              },
            },
            {
              name: "get_staff_member",
              description: "Get detailed information about a specific staff member",
              inputSchema: {
                type: "object",
                properties: {
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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
                  business_id: {
                    type: "string",
                    description: "The business ID",
                  },
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