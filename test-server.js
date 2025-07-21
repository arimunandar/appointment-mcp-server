#!/usr/bin/env node

// Simple test script to verify the MCP server is working
// This script demonstrates how the server would be called

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, 'build', 'index.js');

console.log('Testing Appointment MCP Server...');
console.log('Server path:', serverPath);

// Test that the server can start
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

server.on('close', (code) => {
  console.log('\n--- Test Results ---');
  console.log('Exit code:', code);
  console.log('Error output:', errorOutput);
  
  if (errorOutput.includes('Appointment MCP Server running on stdio')) {
    console.log('✅ Server started successfully!');
  } else {
    console.log('❌ Server failed to start properly');
  }
});

// Send a simple initialization message to test JSON-RPC
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

setTimeout(() => {
  server.stdin.write(JSON.stringify(initMessage) + '\n');
  
  setTimeout(() => {
    server.kill('SIGTERM');
  }, 1000);
}, 500);

console.log('Starting server test...');