#!/usr/bin/env node

// Test script to check the actual status constraint values
import { spawn } from 'child_process';

console.log('🧪 Testing status constraint values...\n');

// Test: Check what status values are actually allowed
console.log('Test: Checking status constraint values');
const test = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'create_appointment',
    arguments: {
      customer_id: 'Test Customer',
      service_id: '550e8400-e29b-41d4-a716-446655440000',
      start_time: '2024-01-15T10:00:00Z',
      end_time: '2024-01-15T11:00:00Z',
      notes: 'Test appointment to check status constraint'
    }
  }
};

test.stdin.write(JSON.stringify(testRequest) + '\n');

let testOutput = '';
test.stdout.on('data', (data) => {
  testOutput += data.toString();
});

test.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

test.on('close', (code) => {
  console.log('Test Result:', testOutput);
  console.log('Test Exit Code:', code);
  console.log('---\n');
  
  console.log('✅ Status constraint test completed!');
});

// Handle process termination
process.on('SIGINT', () => {
  test.kill();
  process.exit(0);
}); 