#!/usr/bin/env node

// Test script to verify appointment creation fixes
import { spawn } from 'child_process';

console.log('🧪 Testing appointment creation fixes...\n');

// Test 1: Create appointment with customer name instead of UUID
console.log('Test 1: Creating appointment with customer name "Lisa Thompson"');
const test1 = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

const test1Request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'create_appointment',
    arguments: {
      customer_id: 'Lisa Thompson',
      service_id: '550e8400-e29b-41d4-a716-446655440000', // Example UUID
      start_time: '2024-01-15T10:00:00Z',
      end_time: '2024-01-15T11:00:00Z',
      notes: 'Test appointment with customer name'
    }
  }
};

test1.stdin.write(JSON.stringify(test1Request) + '\n');

let test1Output = '';
test1.stdout.on('data', (data) => {
  test1Output += data.toString();
});

test1.stderr.on('data', (data) => {
  console.error('Test 1 Error:', data.toString());
});

test1.on('close', (code) => {
  console.log('Test 1 Result:', test1Output);
  console.log('Test 1 Exit Code:', code);
  console.log('---\n');
  
  // Test 2: Create customer by name
  console.log('Test 2: Creating customer by name');
  const test2 = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const test2Request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'create_customer_by_name',
      arguments: {
        customer_name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        notes: 'Test customer created by name'
      }
    }
  };

  test2.stdin.write(JSON.stringify(test2Request) + '\n');

  let test2Output = '';
  test2.stdout.on('data', (data) => {
    test2Output += data.toString();
  });

  test2.stderr.on('data', (data) => {
    console.error('Test 2 Error:', data.toString());
  });

  test2.on('close', (code) => {
    console.log('Test 2 Result:', test2Output);
    console.log('Test 2 Exit Code:', code);
    console.log('---\n');
    
    console.log('✅ Testing completed!');
  });
});

// Handle process termination
process.on('SIGINT', () => {
  test1.kill();
  process.exit(0);
}); 