#!/usr/bin/env node

// Test script for the comprehensive appointment conflict checking tool
import { spawn } from 'child_process';

// Set environment variables
process.env.BUSINESS_ID = '2277d67d-f2c5-47bf-8c9e-679080a81477';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

// Test cases for the comprehensive conflict checking tool
const testCases = [
  {
    name: "Valid Appointment Check",
    args: {
      service_id: "550e8400-e29b-41d4-a716-446655440050", // Personal Training Session
      staff_id: "550e8400-e29b-41d4-a716-446655440070", // Sarah Johnson
      customer_id: "550e8400-e29b-41d4-a716-446655440150", // Ahmad Rizki
      start_time: "2025-07-23T14:00:00",
      end_time: "2025-07-23T15:00:00"
    }
  },
  {
    name: "Staff Service Mismatch Check",
    args: {
      service_id: "550e8400-e29b-41d4-a716-446655440050", // Personal Training Session
      staff_id: "550e8400-e29b-41d4-a716-446655440071", // Michael Chen (doesn't provide Personal Training)
      customer_id: "550e8400-e29b-41d4-a716-446655440150", // Ahmad Rizki
      start_time: "2025-07-23T14:00:00",
      end_time: "2025-07-23T15:00:00"
    }
  },
  {
    name: "Outside Business Hours Check",
    args: {
      service_id: "550e8400-e29b-41d4-a716-446655440050", // Personal Training Session
      staff_id: "550e8400-e29b-41d4-a716-446655440070", // Sarah Johnson
      customer_id: "550e8400-e29b-41d4-a716-446655440150", // Ahmad Rizki
      start_time: "2025-07-23T23:00:00", // 11 PM - outside business hours
      end_time: "2025-07-24T00:00:00"
    }
  },
  {
    name: "Invalid Time Range Check",
    args: {
      service_id: "550e8400-e29b-41d4-a716-446655440050", // Personal Training Session
      staff_id: "550e8400-e29b-41d4-a716-446655440070", // Sarah Johnson
      customer_id: "550e8400-e29b-41d4-a716-446655440150", // Ahmad Rizki
      start_time: "2025-07-23T15:00:00", // Start after end
      end_time: "2025-07-23T14:00:00"
    }
  },
  {
    name: "Past Date Check",
    args: {
      service_id: "550e8400-e29b-41d4-a716-446655440050", // Personal Training Session
      staff_id: "550e8400-e29b-41d4-a716-446655440070", // Sarah Johnson
      customer_id: "550e8400-e29b-41d4-a716-446655440150", // Ahmad Rizki
      start_time: "2020-01-01T14:00:00", // Past date
      end_time: "2020-01-01T15:00:00"
    }
  }
];

async function testTool(toolName, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      }
    });

    // Send the tool call
    const toolCall = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    child.stdin.write(JSON.stringify(toolCall) + '\n');
    child.stdin.end();
  });
}

async function runTests() {
  console.log('Testing comprehensive appointment conflict checking tool...\n');

  for (const testCase of testCases) {
    try {
      console.log(`Testing ${testCase.name}...`);
      console.log(`Args: ${JSON.stringify(testCase.args, null, 2)}`);
      const result = await testTool('check_appointment_conflict', testCase.args);
      console.log(`✅ ${testCase.name} - SUCCESS`);
      console.log('Result:', result);
      console.log('---\n');
    } catch (error) {
      console.log(`❌ ${testCase.name} - FAILED`);
      console.log('Error:', error.message);
      console.log('---\n');
    }
  }
}

// Run the tests
runTests().catch(console.error); 