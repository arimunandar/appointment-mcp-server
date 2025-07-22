#!/usr/bin/env node

// Database CRUD Test Suite
// This script tests all database operations to identify issues

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// Get database URL from environment or use default
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.kcnksejcbesfdenjmwqd:K5hJFHMKLb07jlxe@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

// Helper function to generate UUID
function generateUUID() {
  return randomUUID();
}

// Helper function to validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL environment variable');
  console.log('Please set DATABASE_URL in your .env file or environment');
  process.exit(1);
}

console.log('🔗 Connecting to database...');
console.log('Database URL:', databaseUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper function to execute queries
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    console.log('📝 Executing query:', text);
    console.log('📝 Parameters:', params);
    const result = await client.query(text, params);
    console.log('✅ Query successful, rows returned:', result.rows.length);
    return result;
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Test functions
async function testDatabaseConnection() {
  console.log('\n🧪 Testing database connection...');
  try {
    const result = await query('SELECT NOW() as current_time, version() as version');
    console.log('✅ Database connection successful');
    console.log('📊 Current time:', result.rows[0].current_time);
    console.log('📊 PostgreSQL version:', result.rows[0].version.split(' ')[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testTableExists() {
  console.log('\n🧪 Testing if required tables exist...');
  const tables = ['businesses', 'customers', 'services', 'appointments', 'staff'];
  
  for (const table of tables) {
    try {
      const result = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' exists`);
        
        // Check table structure
        const columns = await query(
          `SELECT column_name, data_type, is_nullable 
           FROM information_schema.columns 
           WHERE table_name = $1 
           ORDER BY ordinal_position`,
          [table]
        );
        
        console.log(`📊 Table '${table}' columns:`);
        columns.rows.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      } else {
        console.error(`❌ Table '${table}' does not exist`);
      }
    } catch (error) {
      console.error(`❌ Error checking table '${table}':`, error.message);
    }
  }
}

async function testBusinessOperations() {
  console.log('\n🏢 Testing business operations...');
  
  const businessId = generateUUID();
  console.log(`🆔 Generated business UUID: ${businessId}`);
  
  try {
    // Test creating a business
    console.log('📝 Executing query: INSERT INTO businesses (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)');
    console.log('📝 Parameters:', [
      businessId,
      'Test Business',
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    
    const createResult = await query(
      'INSERT INTO businesses (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
      [businessId, 'Test Business', new Date().toISOString(), new Date().toISOString()]
    );
    console.log('✅ Business created successfully');
    
    // Test reading the business
    const readResult = await query(
      'SELECT * FROM businesses WHERE id = $1',
      [businessId]
    );
    
    if (readResult.rows.length > 0) {
      console.log('✅ Business read successfully:', readResult.rows[0]);
    } else {
      console.log('❌ Business not found after creation');
    }
    
    // Test updating the business
    const updateResult = await query(
      'UPDATE businesses SET name = $1, updated_at = $2 WHERE id = $3',
      ['Updated Test Business', new Date().toISOString(), businessId]
    );
    console.log('✅ Business updated successfully');
    
    // Test deleting the business
    const deleteResult = await query(
      'DELETE FROM businesses WHERE id = $1',
      [businessId]
    );
    console.log('✅ Business deleted successfully');
    
  } catch (error) {
    console.error('❌ Business operations failed:', error.message);
    console.error('❌ Full error:', error);
  }
}

async function testCustomerOperations() {
  console.log('\n🧪 Testing customer operations...');
  const testBusinessId = generateUUID();
  const testCustomerId = generateUUID();
  
  console.log(`🆔 Generated business UUID: ${testBusinessId}`);
  console.log(`🆔 Generated customer UUID: ${testCustomerId}`);
  
  try {
    // First check the customers table structure
    console.log('📝 Checking customers table structure...');
    const tableInfo = await query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'customers' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    console.log('📊 Customers table columns:', tableInfo.rows);
    
    // First create a business
    await query(
      'INSERT INTO businesses (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
      [testBusinessId, `Test Business`, new Date().toISOString(), new Date().toISOString()]
    );
    
    // Test creating a customer
    console.log('📝 Creating test customer...');
    console.log('📝 Executing query: INSERT INTO customers (business_id, first_name, last_name, email, phone_number, notes, created_at, updated_at)\n       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)\n       RETURNING *');
    console.log('📝 Parameters:', [
       testBusinessId,
       'John',
       'Doe',
       'john.doe@example.com',
       '+1234567890',
       'Test customer',
       new Date().toISOString(),
       new Date().toISOString()
     ]);
    
    const createResult = await query(
        `INSERT INTO customers (business_id, first_name, last_name, email, phone_number, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          testBusinessId,
          'John',
          'Doe',
          'john.doe@example.com',
          '+1234567890',
          'Test customer',
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    
    if (createResult.rows.length > 0) {
      console.log('✅ Customer created successfully');
      console.log('📊 Customer data:', createResult.rows[0]);
      
      const customerId = createResult.rows[0].id;
      
      // Test reading the customer
      console.log('📝 Reading test customer...');
      const customer = await query(
        'SELECT * FROM customers WHERE id = $1 AND business_id = $2',
        [customerId, testBusinessId]
      );
      
      if (customer.rows.length > 0) {
        console.log('✅ Customer read successfully');
      } else {
        console.error('❌ Customer not found after creation');
      }
      
      // Test updating the customer
      console.log('📝 Updating test customer...');
      await query(
        'UPDATE customers SET first_name = $1, updated_at = $2 WHERE id = $3 AND business_id = $4',
        ['Jane', new Date().toISOString(), customerId, testBusinessId]
      );
      console.log('✅ Customer updated successfully');
      
      // Test deleting the customer
      console.log('📝 Deleting test customer...');
      await query('DELETE FROM customers WHERE id = $1', [customerId]);
      console.log('✅ Customer deleted successfully');
    }
    
    // Clean up business
    await query('DELETE FROM businesses WHERE id = $1', [testBusinessId]);
    
  } catch (error) {
    console.error('❌ Customer operations failed:', error.message);
    console.error('❌ Full error:', error);
  }
}

async function testPermissions() {
  console.log('\n🧪 Testing database permissions...');
  
  try {
    // Test SELECT permission
    console.log('📝 Testing SELECT permission...');
    await query('SELECT 1 as test');
    console.log('✅ SELECT permission OK');
    
    // Test INSERT permission
    console.log('📝 Testing INSERT permission...');
    const testId = generateUUID();
    console.log(`🆔 Generated permission test UUID: ${testId}`);
    await query(
      'INSERT INTO businesses (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)',
      [testId, 'Permission Test', new Date().toISOString(), new Date().toISOString()]
    );
    console.log('✅ INSERT permission OK');
    
    // Test UPDATE permission
    console.log('📝 Testing UPDATE permission...');
    await query(
      'UPDATE businesses SET name = $1 WHERE id = $2',
      ['Updated Permission Test', testId]
    );
    console.log('✅ UPDATE permission OK');
    
    // Test DELETE permission
    console.log('📝 Testing DELETE permission...');
    await query('DELETE FROM businesses WHERE id = $1', [testId]);
    console.log('✅ DELETE permission OK');
    
  } catch (error) {
    console.error('❌ Permission test failed:', error.message);
    console.error('❌ This might indicate RLS (Row Level Security) issues or insufficient permissions');
  }
}

async function runAllTests() {
  console.log('🚀 Starting Database CRUD Test Suite\n');
  
  try {
    // Test 1: Database Connection
    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      console.log('\n❌ Stopping tests due to connection failure');
      return;
    }
    
    // Test 2: Table Structure
    await testTableExists();
    
    // Test 3: Permissions
    await testPermissions();
    
    // Test 4: Business Operations
    await testBusinessOperations();
    
    // Test 5: Customer Operations
    await testCustomerOperations();
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    console.error('💥 Full error:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the tests
runAllTests().catch(console.error);