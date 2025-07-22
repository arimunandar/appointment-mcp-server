#!/usr/bin/env node

// Test script for the new availability and staff tools
import { spawn } from 'child_process';

// Set environment variables
process.env.BUSINESS_ID = '2277d67d-f2c5-47bf-8c9e-679080a81477';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

// Test cases
const testCases = [
  {
    name: "get_staff_availability",
    args: {
      date: "2025-01-27"
    }
  },
  {
    name: "get_available_time_slots",
    args: {
      service_id: "550e8400-e29b-41d4-a716-446655440050", // Personal Training Session
      date: "2025-01-27"
    }
  },
  {
    name: "get_all_staff_info",
    args: {}
  },
  {
    name: "get_staff_member",
    args: {
      staff_id: "550e8400-e29b-41d4-a716-446655440070" // Sarah Johnson
    }
  },
  {
    name: "get_staff_time_off",
    args: {
      start_date: "2025-01-01",
      end_date: "2025-01-31"
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
  console.log('Testing new availability and staff tools...\n');

  for (const testCase of testCases) {
    try {
      console.log(`Testing ${testCase.name}...`);
      const result = await testTool(testCase.name, testCase.args);
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