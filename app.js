
//const connection = new SQLiteCloudConnection({
//  });
////const result = db.sql`SELECT * FROM <tablename>;`;
//const db = new Database(process.env.APIKEY)
//const fetchAlbums = async () => await db.sql`USE DATABASE chinook.sqlite; SELECT * FROM albums;`;
import express from "express"
import cors from "cors"
import fetch from 'node-fetch'
import { Database,SQLiteCloudConnection } from '@sqlitecloud/drivers';
//
const app = express()
var whitelist = process.env.whitelist
var corsOptions = {
  origin: whitelist,
  credentials: true
};
//https://www.realestate.com.au/property-house-nsw-rose+bay-145264284
//will need to make changes to this or background.js so that values not present are default to N/A
//NEXT STEP: WORK ON DUPLICATE TRIGGERS BOTH TO API AND SQLITE TABLE.
app.use(express.urlencoded({ extended: true }))
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.text())
app.use(express.static('public'))
//console.log(process.env.SQLURL)

let db; // Global database connection
// Store the DB connection globally to reuse it across requests
let dbConnection = null; 
let inactivityTimer = null; // Timer to track inactivity
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout
// test
// Function to get the DB connection
async function getDbConnection() {
  //if (db) {
  //  return db;  // Return existing connection
  //}
  //db = await connecttoDB();  // If no connection, create a new one
  //return db;
  if (!dbConnection) {
    dbConnection = await connecttoDB(); // Get a new connection if none exists
  }
  // Reset inactivity timer on every new request
  resetInactivityTimer();
  return dbConnection;
}

// Function to reset the inactivity timer
function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer); // Clear the previous timer
  }

  // Set a new timer to close the connection after the specified timeout
  inactivityTimer = setTimeout(async () => {
    if (dbConnection) {
      console.log('Closing DB connection due to inactivity...');
      await dbConnection.close(); // Close the connection after inactivity
      dbConnection = null; // Reset the connection
    }
  }, INACTIVITY_TIMEOUT);
}

//async function connecttoDB() {
//  let retries = 3;
//  const initialDelay = 5000; // Start with 5 seconds delay
//  let currentDelay = initialDelay;
//  const maxDelay = 30000; // Max delay 30 seconds
//  const connectTimeout = 20000; // Timeout for a single connection attempt (ms)
//  console.log('Starting database connection process...');
//   // --- Construct the full connection string with parameters (adjust as needed) ---

//  if (!baseConnectionString) {
//  throw new Error("APIKEY environment variable is not set.");
//  } 
//  //const baseConnectionString = process.env.APIKEY;
//  const separator = baseConnectionString.includes('?') ? '&' : '?';
//  // Check SQLite Cloud docs for correct parameter names for timeout and TLS
//  const fullConnectionString = `${baseConnectionString}`//timeout=${connectTimeout}&tls=true`//${separator}timeout=${connectTimeout}&tls=true`;
//  //const fullConnectionString = `${baseConnectionString}$`;
//  console.log('Using connection string:', fullConnectionString); // Careful logging sensitive info
//  while (retries > 0) {
//    console.log(`Attempting connection... (Attempt ${4 - retries} of 3), Timeout: ${connectTimeout}ms`);
//    let attemptSuccessful = false;
//    try {
//        const db = await new Promise((resolve, reject) => {
//            let connectionTimer = null;
//            let dbInstance = null;
//            let errorListener = null;
//            let readyListener = null; // Or 'connect', 'open', etc. based on driver
//
//            const cleanup = () => {
//                if (connectionTimer) clearTimeout(connectionTimer);
//                if (dbInstance) {
//                    // Remove specific listeners attached during setup
//                    if (errorListener) dbInstance.removeListener('error', errorListener);
//                    if (readyListener) dbInstance.removeListener('ready', readyListener); // Use correct event name
//                }
//            };
//
//            // Define the error handler for the setup phase
//            errorListener = (err) => {
//                console.error(`Connection setup error event: Code='${err.code}', Message='${err.message}'`);
//                cleanup();
//                // Reject the promise, passing the error object
//                reject(err);
//            };
//
//            // Define the success handler (!! CHECK DRIVER DOCS FOR CORRECT EVENT NAME !!)
//            // Common names: 'ready', 'connect', 'open'
//            const successEventName = 'ready'; // <--- !!! REPLACE 'ready' if needed !!!
//            readyListener = () => {
//                console.log(`Driver emitted '${successEventName}' event.`);
//                cleanup();
//
//                // Attach the persistent runtime error listener AFTER successful connection
//                dbInstance.on('error', (runtimeErr) => {
//                    console.error('Database connection runtime error:', runtimeErr);
//                    // Invalidate global connection if this instance is the active one
//                    if (dbConnection === dbInstance) {
//                        console.log("Invalidating global DB connection due to runtime error.");
//                        if (inactivityTimer) clearTimeout(inactivityTimer);
//                        dbConnection = null;
//                    }
//                });
//
//                resolve(dbInstance); // Connection succeeded
//            };
//
//            // Start the connection timeout timer
//            connectionTimer = setTimeout(() => {
//                console.error(`Connection attempt timed out after ${connectTimeout}ms.`);
//                cleanup();
//                 // Explicitly close if instance exists but didn't connect/error
//                //if (dbInstance && typeof dbInstance.close === 'function') {
//                //    dbInstance.close().catch(closeErr => console.error("Error closing timed-out instance:", closeErr));
//                //}
//                reject(new Error(`Connection attempt timed out after ${connectTimeout}ms`));
//            }, connectTimeout);
//
//            try {
//                // Instantiate the database object
//                console.log("Instantiating Database object...");
//                dbInstance = new Database(fullConnectionString);
//
//                // Attach listeners using .once() - they automatically detach after firing
//                console.log(`Attaching .once('${successEventName}') and .once('error') listeners.`);
//                dbInstance.once(successEventName, readyListener);
//                dbInstance.once('error', errorListener);
//
//                // If the constructor itself can throw synchronously (less likely for network)
//            } catch (constructorError) {
//                console.error("Error during Database constructor:", constructorError);
//                cleanup();
//                reject(constructorError); // Reject the promise
//            }
//        });
//
//        // If the promise above resolved successfully:
//        console.log(`Connection appears successful! (Attempt ${4 - retries})`);
//        attemptSuccessful = true;
//        currentDelay = initialDelay; // Reset delay on success
//        return db; // Return the connected instance
//
//    } catch (error) {
//        // This catch block handles rejections from the promise
//        console.error(`Connection attempt ${4 - retries} failed: ${error.message}`);
//
//        // *** Specifically check for ECONNRESET ***
//        if (error.code === 'ECONNRESET') {
//            console.log("ECONNRESET detected. Will retry.");
//            // Proceed with retry logic below
//        } else if (error.message && error.message.includes('timed out')) {
//            console.log("Connection attempt timed out. Will retry.");
//             // Proceed with retry logic below
//        } else {
//            // Optional: Decide if other errors should stop retries immediately
//            // Example: Authentication errors, invalid connection string errors
//            // if (error.message.includes('Authentication failed')) {
//            //    console.error("Authentication failed. Aborting retries.");
//            //    throw error; // Re-throw immediately to stop retries
//            // }
//            console.log("Caught other connection error. Will retry.");
//            // Proceed with retry logic below for now
//        }
//
//        retries--; // Decrement retries *only* after a failure
//
//        if (retries === 0) {
//            console.error('Max connection retries reached. Unable to establish database connection.');
//            throw new Error(`Unable to connect after multiple attempts. Last error: ${error.message}`); // Throw final error
//        }
//
//        // Apply exponential backoff with jitter
//        const jitter = Math.random() * 1000; // Add up to 1 second jitter
//        const delayWithBackoff = Math.min(currentDelay + jitter, maxDelay);
//        console.log(`Retrying connection in approximately ${(delayWithBackoff / 1000).toFixed(1)} seconds...`);
//        await new Promise(resolve => setTimeout(resolve, delayWithBackoff));
//        currentDelay = Math.min(currentDelay * 2, maxDelay); // Double delay for next time, capped
//
//    }
//    // The loop continues if retries > 0 and no success/fatal error occurred
//}
// Fallback if loop somehow exits unexpectedly
//throw new Error("Database connection failed after exhausting retries.");
//}


async function connecttoDB() {
  let retries = 3;
  const delay = 5000; // 5 seconds delay between retries
  const timeout = 20000 // Increase timeout to 10 seconds (default is often much lower)
  console.log('Starting database connection process...');
   // --- Construct the full connection string with parameters (adjust as needed) ---
  const baseConnectionString = `process.env.DATABASE_URL`//APIKEY
  if (!baseConnectionString) {
  throw new Error("APIKEY environment variable is not set.");
  } 
  //const baseConnectionString = process.env.APIKEY;
  const separator = baseConnectionString.includes('?') ? '&' : '?';
  // Check SQLite Cloud docs for correct parameter names for timeout and TLS
  //const fullConnectionString = `${baseConnectionString}${separator}timeout=${connectTimeout}&tls=true`;
  console.log('Using connection string:', baseConnectionString) //fullConnectionString); // Careful logging sensitive info
  while (retries > 0) {
    console.log(`Attempting to connect to the database... (${4 - retries} out of 3 retries)`);
    let attemptSuccessful = false;
    try {
      
      const options = {
        timeout: timeout, // Increase timeout to 10 seconds (default is often much lower)
        tls: {
          rejectUnauthorized: true, // Ensure the connection uses a valid certificate
        },
      };
      // Log the connection URL and options (be careful with sensitive info)
      console.log('Connection options:', options);
      //const db = new Database(process.env.APIKEY)
      //const baseConnectionString = process.env.APIKEY;
      //if (!baseConnectionString) {
      //    throw new Error("APIKEY environment variable is not set.");
      //}
      const db = new Database(`process.env.DATABASE_URL`, options); //APIKEY
      //console.log('Connected to SQLite Cloud successfully');
      // Listen for 'error' event on db
      db.on('error', (err) => {
        console.error('Database connection error:', err);
        if (err.message.includes('Client network socket disconnected before secure TLS connection was established')) {
          console.error('Specific Runtime Error Detected: TLS handshake failed or socket disconnected *after* initial connection phase.');
        }
        if (dbConnection === db) { // Only invalidate if it's the current global connection
          console.log("Invalidating global connection due to runtime error.");
          if (inactivityTimer) clearTimeout(inactivityTimer);
          dbConnection = null; // Force reconnect on next request
          //Just added below 2 lines
          if (db && typeof db.close === 'function') {
            db.close().catch(closeErr => console.error("Error closing connection during runtime error handling:", closeErr.message));
         }
      }
      });
      // 3. *** Explicitly connect and wait for TLS handshake ***
      // Replace 'connect' with the actual method name from the driver docs
      console.log("Initiating connection and TLS handshake...");
      // Just added below 6 lines
      if (typeof db.connect === 'function') {
          await db.connect(); // Ensure this promise completion means TLS is established
    } else if (typeof db.open === 'function') {
          await db.open();
    } else {
       console.warn("No explicit connect/open method found. Connection might be implicit. Ensure first operation handles potential errors.");
       // Consider a test query here if connection is implicit: await db.execute('SELECT 1');
   }
      //await db.connect({ timeout: timeout }); // Pass timeout if method allows
      const successfulRetries = 3 - retries; 
      console.log(`Connection successful! Retries taken: ${successfulRetries}`);
      console.log(`Connection and TLS handshake successful! (Attempt ${4 - retries})`);
      return db;
    } catch (error) {
      console.error(`Error connecting to SQLite Cloud (Attempt ${4 - retries}):, ${error.message}`);
      // Just added below 4 lines
      if (error.message.includes('Client network socket disconnected before secure TLS connection was established')) {
        // Log that this specific error is triggering the retry.
        console.error(`>>> TLS Handshake Error Detected on attempt ${attempt}. Retrying...`);
    } else if (error.code === 'ETIMEOUT' || error.message.toLowerCase().includes('timeout') || error.code === 'ECONNRESET') {
         console.error(`>>> Connection attempt ${attempt} timed out. Retrying...`);
    }
    // Add other specific error checks if needed

    // Cleanup the failed connection object before retrying
      if (db && typeof db.close === 'function') {
        try { await db.close(); } catch (closeErr) { /* ignore close error during failure */ 
          console.log(`Warning: Error closing connection during cleanup for attempt ${attempt}: ${closeErr.message}`);
        }
     }
     db = null
     if (retries === 1) {
        console.error('Max retries reached. Unable to connect.');
        throw new Error('Unable to connect after multiple attempts');
      }
      
      retries--;
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay)); // Delay before retrying
    }
  }
}
// Mapping from the JSON key paths to the variable names you want
const keyMapping = {
 //"data.info.requestDate": "RequestDate",
  "data.property.detail.id": "PropertyID",
  "data.property.detail.propertyType": "PropertyType",
  "data.property.detail.propertySubType": "PropertySubType",
  "data.property.detail.occupancy": "PropertyOccupancy",
  "data.property.detail.geolocation.latitude": "Latitude",
  "data.property.detail.geolocation.longitude": "Longitude",
  "data.property.detail.address.singleLine": "AddressSingleLine",
  "data.property.detail.address.startNumber": "AddressNumber",
  "data.property.detail.address.street.id": "StreetID",
  "data.property.detail.address.street.extension": "StreetType",
  "data.property.detail.address.street.name": "StreetName",
  "data.property.detail.address.street.locality.id": "SuburbID",
  "data.property.detail.address.street.locality.name": "SuburbName",
  "data.property.detail.address.street.locality.postcode.id": "PostcodeID",
  "data.property.detail.address.street.locality.postcode.name": "Postcode",
  "data.property.detail.address.street.locality.postcode.state": "State",
  "data.property.detail.avm.estimateLow": "LowEstimate",
  "data.property.detail.avm.estimateHigh": "HighEstimate",
  "data.property.detail.avm.confidenceLevel": "EstimateConfidence",
  "data.property.detail.avm.source": "EstimateSource",
  "data.property.detail.avm.valuationDate": "EstimateDate",
  "data.property.detail.attributes.bedrooms": "Bedrooms",
  "data.property.detail.attributes.bathrooms": "Bathrooms",
  "data.property.detail.attributes.carSpaces": "CarSpaces",
  "data.property.detail.attributes.floorArea": "FloorArea",
  "data.property.detail.attributes.landArea": "LandArea",
  "data.property.detail.attributes.lockUpGarages": "Garages",
  "data.property.detail.attributes.yearBuilt": "YearBuilt",
  //"data.property.detail.saleHistory": "SaleHistory",
  "data.property.detail.saleHistory[0].transferId": "SaleHistoryTransferID",
  "data.property.detail.saleHistory[0].contractDate": "SaleHistoryContractDate",
  "data.property.detail.saleHistory[0].settlementDate": "SaleHistorySettlementDate",
  "data.property.detail.saleHistory[0].saleType": "SaleHistorySaleType",
  "data.property.detail.saleHistory[0].price": "SaleHistoryPrice",
  "data.property.detail.saleHistory[0].priceFrom": "SaleHistoryPriceFrom",
  "data.property.detail.saleHistory[0].priceTo": "SaleHistoryPriceTo",
  "data.property.detail.saleHistory[1].transferId": "SaleHistoryTransferID_1",
  "data.property.detail.saleHistory[1].contractDate": "SaleHistoryContractDate_1",
  "data.property.detail.saleHistory[1].settlementDate": "SaleHistorySettlementDate_1",
  "data.property.detail.saleHistory[1].saleType": "SaleHistorySaleType_1",
  "data.property.detail.saleHistory[1].price": "SaleHistoryPrice_1",
  "data.property.detail.saleHistory[1].priceFrom": "SaleHistoryPriceFrom_1",
  "data.property.detail.saleHistory[1].priceTo": "SaleHistoryPriceTo_1",
  "data.property.detail.saleHistory[2].transferId": "SaleHistoryTransferID_2",
  "data.property.detail.saleHistory[2].contractDate": "SaleHistoryContractDate_2",
  "data.property.detail.saleHistory[2].settlementDate": "SaleHistorySettlementDate_2",
  "data.property.detail.saleHistory[2].saleType": "SaleHistorySaleType_2",
  "data.property.detail.saleHistory[2].price": "SaleHistoryPrice_2",
  "data.property.detail.saleHistory[2].priceFrom": "SaleHistoryPriceFrom_2",
  "data.property.detail.saleHistory[2].priceTo": "SaleHistoryPriceTo_2",
  "data.property.detail.saleHistory[3].transferId": "SaleHistoryTransferID_3",
  "data.property.detail.saleHistory[3].contractDate": "SaleHistoryContractDate_3",
  "data.property.detail.saleHistory[3].settlementDate": "SaleHistorySettlementDate_3",
  "data.property.detail.saleHistory[3].saleType": "SaleHistorySaleType_3",
  "data.property.detail.saleHistory[3].price": "SaleHistoryPrice_3",
  "data.property.detail.saleHistory[3].priceFrom": "SaleHistoryPriceFrom_3",
  "data.property.detail.saleHistory[3].priceTo": "SaleHistoryPriceTo_3",
  "data.property.detail.saleHistory[4].transferId": "SaleHistoryTransferID_4",
  "data.property.detail.saleHistory[4].contractDate": "SaleHistoryContractDate_4",
  "data.property.detail.saleHistory[4].settlementDate": "SaleHistorySettlementDate_4",
  "data.property.detail.saleHistory[4].saleType": "SaleHistorySaleType_4",
  "data.property.detail.saleHistory[4].price": "SaleHistoryPrice_4",
  "data.property.detail.saleHistory[4].priceFrom": "SaleHistoryPriceFrom_4",
  "data.property.detail.saleHistory[4].priceTo": "SaleHistoryPriceTo_4",
  "data.property.detail.saleHistory[5].transferId": "SaleHistoryTransferID_5",
  "data.property.detail.saleHistory[5].contractDate": "SaleHistoryContractDate_5",
  "data.property.detail.saleHistory[5].settlementDate": "SaleHistorySettlementDate_5",
  "data.property.detail.saleHistory[5].saleType": "SaleHistorySaleType_5",
  "data.property.detail.saleHistory[5].price": "SaleHistoryPrice_5",
  "data.property.detail.saleHistory[5].priceFrom": "SaleHistoryPriceFrom_5",
  "data.property.detail.saleHistory[5].priceTo": "SaleHistoryPriceTo_5",
  "data.property.detail.listingHistory[0].id": "ListingID",
  "data.property.detail.listingHistory[0].daysOnMarket": "ListingDaysListed",
  "data.property.detail.listingHistory[0].listingMethod": "ListingMethod",
  "data.property.detail.listingHistory[0].priceDescription": "ListingDescription",
  "data.property.detail.listingHistory[0].latestPrice": "ListingPrice",
  "data.property.detail.site.zoneCodeLocal": "PropertyZoneCode",
  "data.property.detail.site.zoneDescriptionLocal": "PropertyZoneDescription",
  "data.property.detail.features": "Features"
};

// List of keys to exclude
const excludeKeys = ['isAgentsAdvice'];

function flattenListingHistory(listingHistory) {
  let flattenedData = {};
  //added in this code section 14/3/2025
   // Check if listingHistory is empty, and if so, assign 'N/A' for all keys
  if (listingHistory.length === 0) {
    console.log('Listing history is empty, assigning "N/A" to all listing history keys.');
    // Assign 'N/A' to all keys starting with `data.property.detail.listingHistory`
    Object.keys(keyMapping).forEach((key) => {
      if (key.startsWith('data.property.detail.listingHistory')) {
        flattenedData[keyMapping[key] || key] = 'N/A'; // Use keyMapping, or fallback to the original key
      }
    });
    return flattenedData;
  }
  //Existing Code
  // Iterate through the listingHistory array and create a flattened structure
  listingHistory.forEach((listingItem, index) => {
    Object.keys(listingItem).forEach((key) => {
      // Skip the unwanted keys
      //if (excludeKeys.includes(key)) {
      //  return;
      //}
      const newKey = `data.property.detail.listingHistory[${index}].${key}`;
      const mappedKey = keyMapping[newKey] || newKey; // Use the key mapping if it exists
      flattenedData[mappedKey] = listingItem[key] !== undefined && listingItem[key] !== null ? listingItem[key] : 'N/A';
    });
  });

  return flattenedData;
}

function flattenSaleHistory(saleHistory) {
  let flattenedData = {};
  // Flatten the saleHistory array and map it with dynamic keys
  if (saleHistory.length === 0) {
    console.log('Sales history is empty, assigning "N/A" to all listing history keys.');
    // Assign 'N/A' to all keys starting with `data.property.detail.saleHistory`
    Object.keys(keyMapping).forEach((key) => {
      if (key.startsWith('data.property.detail.saleHistory')) {
        flattenedData[keyMapping[key] || key] = 'N/A'; // Use keyMapping, or fallback to the original key
      }
    });
    return flattenedData;
  }
  saleHistory.forEach((historyItem, index) => {
    Object.keys(historyItem).forEach((key) => {
      // Skip the unwanted keys
      if (excludeKeys.includes(key)) {
        return;
      }
      const newKey = `data.property.detail.saleHistory[${index}].${key}`;
      const mappedKey = keyMapping[newKey] || newKey;
      flattenedData[mappedKey] = historyItem[key] !== undefined && historyItem[key] !== null ? historyItem[key] : 'N/A';
    });
  });

  return flattenedData;
}
// Function to recursively traverse the JSON and build the propertyData object
function buildPropertyData(json) {
  const result = {};
  
  function recursiveExtract(data, path = '') {
    if (data && typeof data === 'object') {
      for (let key in data) {
        if (data.hasOwnProperty(key)) {
          const newPath = path ? `${path}.${key}` : key;
          recursiveExtract(data[key], newPath); //recursive call
        }
      }
    } else {
       // Log the current path and data value to see how paths are being built
       // If it's not an object, check if this path matches one of the keys in the mapping
      if (keyMapping[path]) { // use path instead of newpath
        result[keyMapping[path]] = data !== undefined && data !== null ? data : "N/A";
      }
      // If it's not an object, we save the key path and its value
      //result[path] = data || "N/A";
    }
  }
  // Begin recursive extraction
  recursiveExtract(json);
  // Flatten the JSON object as needed and apply the key mappings
  // Check and map the "features" array if it exists
  if (json && json.data && json.data.property && Array.isArray(json.data.property.detail.features)) {
    result["Features"] = json.data.property.detail.features.length > 0 
      ? json.data.property.detail.features.join(", ")  // Joining the array items with a comma
      : "N/A";  // If the array is empty, set as "N/A"
  }
  // Process saleHistory, if it exists and is an array
  if (json && json.data && json.data.property && json.data.property.detail) {
    // Flatten the saleHistory array into a desired structure
    if (json.data.property.detail.saleHistory && Array.isArray(json.data.property.detail.saleHistory)) {
      const flattenedSaleHistory = flattenSaleHistory(json.data.property.detail.saleHistory);
      // Add all sale history data into the result
      Object.assign(result, flattenedSaleHistory);
    }
  }
   // Flatten the listingHistory array if it exists
   if (json.data.property.detail.listingHistory && Array.isArray(json.data.property.detail.listingHistory)) {
    const flattenedListingHistory = flattenListingHistory(json.data.property.detail.listingHistory);
    Object.assign(result, flattenedListingHistory); // Merge the flattened data into the result object
  }
  return result;
}

// Ensure the table exists before handling requests
async function createTableIfNotExists(db, keyMapping, retries = 3, delay = 2000) {
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
          ID INTEGER PRIMARY KEY AUTOINCREMENT,
          CreatedAt TEXT DEFAULT (strftime('%d-%m-%Y','now')),
          ${columns}
      );
    `;
   
    //const result = await db.sql`
   // const createTableQuery = `
   //   CREATE TABLE IF NOT EXISTS properties (
   //       ID INTEGER PRIMARY KEY AUTOINCREMENT, -- Automatically increments for each row
   //       CreatedAt DATE DEFAULT (CURRENT_DATE),
   //       ${columns}
   //   );
   // `;
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
//// Create the table when the application starts
//connecttoDB()
//createTableIfNotExists(keyMapping);

//function getNestedValue(obj, path) {
//  // Split the path into individual keys
//  const keys = path.split('.');
//  
//  // Traverse the object following the path
//  for (let key of keys) {
//    if (obj && obj.hasOwnProperty(key)) {
//      obj = obj[key]; // Update the object to the nested object at each step
//    } else {
//      return 'N/A'; // Return 'N/A' if the key is not found at any level
//    }
//  }
//  return obj !== undefined && obj !== null ? obj : 'N/A'; // Return the final value or 'N/A' if it's null or undefined
//}

// Insert function for SQLite database
async function insertIntoProperties(db, propertyData, keyMapping, retries = 3, delay = 2000) {
  try {
    const mappedDbColumnNames = Object.values(keyMapping);
    const columnsSql = mappedDbColumnNames.map(name => `"${name.replace(/[^a-zA-Z0-9_]/g, '')}"`).join(", ");
    const placeholdersSql = mappedDbColumnNames.map(() => '?').join(", ");

    // Prepare the array of values by looking up data using DB column names in propertyData
    const values = mappedDbColumnNames.map(dbColumnName => {
      const value = propertyData[dbColumnName]; // Use the DB column name as the key here
      return (value !== undefined && value !== null) ? value : 'N/A';
    });

    const insertQuery = `
      INSERT INTO properties (${columnsSql})
      VALUES (${placeholdersSql});
    `;
  //  const mappedKeys = Object.values(keyMapping);
  //  const columns = mappedKeys.join(", ");
  //  const placeholders = mappedKeys.map(() => '?').join(", "); // Generate ?, ?, ...
//
  //  const values = Object.values(keyMapping).map(mappedKey => {
  //    return propertyData[mappedKey] !== undefined && propertyData[mappedKey] !== null
  //      ? String(propertyData[mappedKey]) // Ensure values are strings if columns are TEXT
  //      : 'N/A';
  //  });
//
  //  const insertQuery = `
  //    INSERT INTO properties (${columns})
  //    VALUES (${placeholders});
  //  `;
  //  //const columns = Object.values(keyMapping).join(", ");
    //const values = Object.keys(keyMapping).map(keyPath => {
    //  //return getNestedValue(propertyData, keyPath);
    //  // Fetch the value from the propertyData, directly using the mapped key
    //  return propertyData[keyMapping[keyPath]] !== undefined && propertyData[keyMapping[keyPath]] !== null 
    //    ? propertyData[keyMapping[keyPath]] 
    //    : 'N/A'; // If the value is missing, insert 'N/A'
    //});
    //const insertQuery = `
    //  INSERT INTO properties (${columns})
    //  VALUES (${values.map(value => `'${value}'`).join(", ")});
    //`;
    //await db.sql(insertQuery);
    await db.run(insertQuery, values) // Use run() with parameters to avoid SQL injection
    //await db.close();
    const successfulRetries = 3 - retries;
    //console.log(`Data inserted successfully. `);
    console.log(`Data inserted successfully for PropertyID: ${propertyData['PropertyID'] || 'Unknown'}. Retries taken: ${successfulRetries}`);
  } catch (error) {
      if (retries > 0) {
      console.error(`Error inserting data: ${error.message}. Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retry
      return insertIntoProperties(db, propertyData, keyMapping, retries - 1, delay * 2); // Exponential backoff
    } else {
      console.error(`Error inserting data after multiple retries (PropertyID: ${propertyData['PropertyID'] || 'Unknown'}):`, error);
      throw new Error('Unable to insert data after multiple retries');
    }
  }
}
// Helper function to handle retries for API requests
async function fetchDataWithRetry(url, retries = 3, delay = 5000) {
  while (retries > 0) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`API request to ${url} failed with status: ${response.status}. Retrying if possible...`);
        throw new Error(`API request failed with status: ${response.status}`);
      }
      //return await response.json();
      const data =  await response.json();
      return data
    } catch (error) {
      if (retries <= 1) throw error; // Fail after the last retry
      console.error(`Error fetching data from ${url}: ${error.message}. Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries--;
    }
  }
}

app.get('/CoreLogic/:address', async (request, response) => {
  const address = request.params.address
  console.log("Request received for ", address)
  //const address2 = "200%20Andaman%20Street%20Kings%Park%NSW%202148"
  const api_url = `https://digital-api.stgeorge.com.au/property-insights?q=${address}`;
  
  try {
    const fetch_response = await fetch(api_url);
    //const fetch_response = await fetchDataWithRetry(api_url);
    const json = await fetch_response.json();
    //console.log(`API request for property address returned response code: ${response.status}`)
    console.log(fetch_response)
    // Check if json.data and json.data.results exist and are not empty
    if (!json.data || !json.data.results || json.data.results.length === 0 || json.data.results == null) {
    //if (!fetch_response.data || !fetch_response.data.results || fetch_response.data.results.length === 0) {
      //console.log("No results found for the address.");
      return response.status(404).json({ message: "No results found for the address" });
    }
    // Proceed with accessing the first result since it's guaranteed to exist
    const add_id = json.data.results[0]?.propertyId;
    //const add_id = fetch_response.data.results[0]?.propertyId;
    if (!add_id) {
      //console.log("Property ID not found");
      return response.status(400).json({ message: "Property ID not found" });
    }
    console.log("Property ID:", add_id);

    const api_url2 = `https://digital-api.stgeorge.com.au/property-insights/property/${add_id}?` //add_id}?`
    const fetch_response2 = await fetch(api_url2);
    //const fetch_response2 = await fetchDataWithRetry(api_url2);
    
    
    console.log(fetch_response2.ok)
    // Check if the second API call is successful (status 200)
    if (!fetch_response2.ok) {
      if (fetch_response2.status == 400){
        return response.status(400).json({  message: "This property is registered as non-residential (such as a school, business or vacant land). No property data available."  });
      }
      else {
        return response.status(fetch_response2.status).json({ message: `Error fetching property data: ${fetch_response2.statusText}`})
      }
    }
    const json2 = await fetch_response2.json();
    console.log(json2.status)
    // // Now, use the function to dynamically build the property data
    const propertyData = buildPropertyData(json2); // Extract all keys and values into a single object
    console.log(propertyData)
    // Immediately send the response back to the client
    //return response.status(200).json({ message: 'Property data fetched', propertyData });
    response.status(200).json({ message: 'Property data fetched', propertyData });
    //// Insert data into the database
    //await insertIntoProperties(propertyData, keyMapping);
  //console.log('New property inserted into the database');
  // Connect to the DB
  (async () => {
    try{
      await insertProperty(propertyData, keyMapping)
      
    } catch (error) {
      console.log("Error inserting into db")
    }})()
     // Perform the database operations in the background asynchronously
     //(async () => {
     //   try {
     //     //const db = await connecttoDB();
     //     const db = await getDbConnection();
     //     // Ensure the table exists before inserting data
     //     await createTableIfNotExists(db, keyMapping);
     //     // Insert data into the database
     //     await insertIntoProperties(db, propertyData, keyMapping);
     //     // Close the DB connection after operation is done
     //     //await db.close();
     //     console.log('New property inserted into the database');
     //   } catch (error) {
     //     console.error("Error inserting data into the database:", error);
     //   }
     // })();  // Immediately invoke the async function for database operation
  //return response.status(200).json({ message: 'Property data inserted into the database', propertyData });
  } catch (error) {
    console.error("Error fetching data:", error);
    return response.status(500).json({ message: "Internal Server Error" });
}
})


  
//app.get('/ArcGIS/:address', async(request, response) => {
//  const address = request.params.address
//  const api_url = ``
//  const fetch_response = await fetch(api_url);
//  const json = await fetch_response.json()
//  //console.log(json)
//  const xmin = json.candidates[0].extent.xmin
//  const xmax = json.candidates[0].extent.xmax
//  const ymin = json.candidates[0].extent.ymin
//  const ymax = json.candidates[0].extent.ymax
//  const api_url2 = `https://maps.six.nsw.gov.au/arcgis/rest/services/public/Valuation/MapServer/5/query?f=json&returnGeometry=true&spatialRel=esriSpatialRelIntersects&geometry=%7B%22xmin%22%3A${xmin}%2C%22ymin%22%3A${ymin}%2C%22xmax%22%3A${xmax}%2C%22ymax%22%3A${ymax}%2CspatialReference%3A%7Bwkid%3A102100%7D%7D&geometryType=esriGeometryEnvelope&inSR=102100&outFields=*&outSR=102100`
//  const fetch_response2 = await fetch(api_url2);
//  const json2 = await fetch_response2.json()
//  //console.log(json2)
//
//  //for (var i=0; i<json2.features.length; i++){
//  //  if (json2.features[i].attributes.address.replace(/\s*$/,"") == address){
//  //    console.log(json2.features[i].attributes)
//  //    response.json(json2.features[i].attributes)
//  //    console.log("Land Value:"+json2.features[i].attributes.val1_lv+" as at "+json2.features[i].attributes.val1_bd)
//  //  }
//  //response.json(json2)
//})
//app.get('/RayWhite/:address', async(request, response) => {
//  const address = request.params.address
//  const api_url = `https://home.raywhite.com/api/v2/address/search?q=${address}`;
//  const fetch_response = await fetch(api_url);
//  const json = await fetch_response.json();
//  //console.log(json.data)
//  response.json(json)
//
//})
async function insertProperty(propertyData, keyMapping) {
  const dbUrl = process.env.DATABASE_URL;
  const db = new Database(dbUrl, {
    timeout: 30000,
    tls: { rejectUnauthorized: true }
  });

  try {
    await db.exec('USE DATABASE pricefinder;'); // Optional if needed

    // Construct INSERT based on mapped keys
    const columns = Object.values(keyMapping).map(k => `"${k.replace(/[^a-zA-Z0-9_]/g, '')}"`).join(", ");
    const placeholders = Object.values(keyMapping).map(() => '?').join(", ");
    const values = Object.values(keyMapping).map(k => {
      const val = propertyData[k];
      return (val !== undefined && val !== null) ? val : 'N/A';
    });

    const query = `INSERT INTO properties (${columns}) VALUES (${placeholders});`;
    await db.sql(query, ...values);

    console.log('Insert successful for property:', propertyData['PropertyID']);
  } catch (err) {
    console.error('Error inserting into SQLite Cloud:', err);
    throw err;
  } finally {
    await db.close(); // Always clean up!
  }
}
export default app
