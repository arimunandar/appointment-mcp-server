#!/usr/bin/env node

// Test script for the new availability checking tools
import { spawn } from 'child_process';

// Set environment variables
process.env.BUSINESS_ID = '2277d67d-f2c5-47bf-8c9e-679080a81477';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

// Test cases for the new availability tools
const testCases = [
  {
    name: "check_business_hours",
    args: {
      date: "2025-01-27"
    }
  },
  {
    name: "check_service_availability",
    args: {
      service_name: "Yoga Class",
      date: "2025-01-27"
    }
  },
  {
    name: "check_service_availability",
    args: {
      service_name: "Yoga Class",
      date: "2025-01-27",
      time: "14:00"
    }
  },
  {
    name: "get_service_time_slots",
    args: {
      service_name: "Yoga Class",
      date: "2025-01-27"
    }
  },
  {
    name: "check_service_availability",
    args: {
      service_name: "Personal Training",
      date: "2025-01-27"
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
  console.log('Testing new availability checking tools...\n');

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