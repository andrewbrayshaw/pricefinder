import { Database } from '@sqlitecloud/drivers';

// Ensure the table exists before handling requests
export async function createTableIfNotExists(db, keyMapping, retries = 3, delay = 2000) {
  try {
    // Dynamically create the SQL for table creation using the keyMapping
    const columns = Object.values(keyMapping).map((columnName) => {
    //  // Ensuring columns are safe, assuming all are TEXT for now
    //  return `${columnName} TEXT`;
    //}).join(",\n");
    const safeColumnName = columnName.replace(/[^a-zA-Z0-9_]/g, '');
    let dataType = 'TEXT';
    if (/id$/i.test(safeColumnName)) dataType = 'INTEGER';
    if (/date$/i.test(safeColumnName)) dataType = 'TEXT'; // Or DATE 'YYYY-MM-DD'
    if (/(latitude|longitude|area|price|estimate)/i.test(safeColumnName)) dataType = 'REAL';
    if (/(bedrooms|bathrooms|carspaces|garages|yearbuilt|dayslisted)/i.test(safeColumnName)) dataType = 'INTEGER';

    return `"${safeColumnName}" ${dataType}`;
  }).join(",\n          ");

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS properties (
          ID INTEGER PRIMARY KEY AUTOINCREMENT,  -- Automatically increments for each row
          CreatedAt TEXT DEFAULT (strftime('%d-%m-%Y','now')),
          ${columns}
      );
    `;
    // Execute the create table query
    await db.sql(createTableQuery);
    const successfulRetries = 3 - retries;
    console.log(`Table "properties" is ready or already exists. Retries taken: ${successfulRetries}`);
  } catch (error) {
      if (retries > 0) {
        console.error(`Error creating table: ${error.message}. Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retry
        return createTableIfNotExists(db, keyMapping, retries - 1, delay * 2); // Exponential backoff
      } else {
        console.error('Error creating table:', error);
        throw new Error('Unable to create table after multiple retries');
      }
  }
}

export async function insertProperty(propertyData, keyMapping) {
  const dbUrl = process.env.DATABASE_URL;
  const db = new Database(dbUrl, {
    timeout: 30000,
    tls: { rejectUnauthorized: true }
  });
  
  try {
    await db.sql('USE DATABASE pricefinder;'); // Optional if needed
    try {
      const result = await db.sql('SELECT * FROM properties LIMIT 3;');
      console.log('Database connection successful:', result);
    } catch (err) {
      console.log('Database connection failed:', err);
    }
    // Construct INSERT based on mapped keys
    const columns = Object.values(keyMapping).map(k => `"${k.replace(/[^a-zA-Z0-9_]/g, '')}"`).join(", ");
    console.log(columns)
    const placeholders = Object.values(keyMapping).map(() => '?').join(", ")
    console.log(placeholders)  
    const values = Object.values(keyMapping).map(k => {
      const val = propertyData[k];
      return (val !== undefined && val !== null) ? val : 'N/A';
    });
    const query = `INSERT INTO properties (${columns}) VALUES (${placeholders});`;
    //await db.sql(query, ...values);
    console.log('Executing query:', query);
    console.log('With values:', values);
    const myinsertdata = await db.sql(query, ...values);
    console.log(myinsertdata)
    //console.log('Insert result:', result);
    console.log('Insert successful for property:', propertyData['PropertyID']);
  } catch (err) {
    console.error('Error inserting into SQLite Cloud:', err);
    throw err;
  } finally {
    await db.close(); // Always clean up!
  }
}
