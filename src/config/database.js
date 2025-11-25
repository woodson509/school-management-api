/**
 * Database Configuration Module
 * Handles PostgreSQL connection pool setup
 */

const { Pool } = require('pg');
const dns = require('dns');
const util = require('util');
require('dotenv').config();

const lookup = util.promisify(dns.lookup);

let pool;

const getPool = async () => {
  if (pool) return pool;

  let config = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (process.env.DATABASE_URL) {
    // Parse the connection string
    // Regex to parse postgres://user:password@host:port/database
    const match = process.env.DATABASE_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

    if (match) {
      const [, user, password, host, port, database] = match;

      // Force IPv4 resolution
      try {
        console.log(`Resolving DNS for ${host}...`);
        const { address } = await lookup(host, { family: 4 });
        console.log(`Resolved ${host} to ${address}`);

        config = {
          ...config,
          user,
          password: decodeURIComponent(password), // Handle encoded passwords
          host: address, // Use the resolved IPv4 address
          port: parseInt(port),
          database,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        };
      } catch (err) {
        console.error('DNS lookup failed, falling back to original host:', err);
        config = {
          ...config,
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        };
      }
    } else {
      // If URL parsing fails, use connectionString directly
      config = {
        ...config,
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      };
    }
  } else {
    config = {
      ...config,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'school_management',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      connectionTimeoutMillis: 2000, // Shorter timeout for local dev
    };
  }

  pool = new Pool(config);

  // Error handling for the pool
  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
  });

  return pool;
};

/**
 * Execute a query with error handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const query = async (text, params) => {
  const p = await getPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
const getClient = async () => {
  const p = await getPool();
  const client = await p.connect();
  const query = client.query;
  const release = client.release;

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
};

module.exports = {
  query,
  getClient,
  pool,
};
