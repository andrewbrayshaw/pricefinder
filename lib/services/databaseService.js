import { MongoClient, ServerApiVersion } from "mongodb"

let client; // MongoClient instance, can be reused across invocations for warm starts
let clientPromise; // Promise for the client connection

/**
 * Establishes and/or returns a reusable connection to MongoDB Atlas.
 * This pattern is recommended for serverless environments to reuse connections
 * across invocations of warm functions.
 */
async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error("MongoDB is not configured in environment variables.");
  }

  // If a connection promise already exists, wait for it to resolve
  // This handles concurrent calls trying to connect simultaneously
  if (clientPromise) {
    // console.log("[DB_MONGO] Waiting for existing connection promise to resolve...");
    await clientPromise;
    // After promise resolves, client should be set. Double check.
    if (client) {
        // Optional: Ping to verify the existing connection is alive, though the driver often handles this.
        // try {
        //   await client.db("admin").command({ ping: 1 });
        //   console.log("[DB_MONGO] Reusing existing MongoDB connection.");
        //   return { client, db: client.db(MONGODB_DB_NAME) };
        // } catch (pingError) {
        //   console.warn("[DB_MONGO] Ping failed on existing connection, will attempt to reconnect.", pingError.message);
        //   client = null; clientPromise = null; // Invalidate to force reconnect
        // }
        // For simplicity now, we assume if clientPromise resolved, client is good.
        // The driver handles a lot of reconnection logic internally.
        return { client, db: client.db() };
    }
    // If clientPromise resolved but client is null, something went wrong, fall through to reconnect
  }

  // If no active client or connection promise, create a new one
  try {
    // console.log("[DB_MONGO] Creating new MongoClient instance.");
    client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 10000, // Time to wait for initial connection
      socketTimeoutMS: 45000,  // Time to wait for a response from the server after connection
      // maxPoolSize: 10, // Default is usually 100. For Vercel, a smaller pool might be okay
                       // depending on expected concurrency per function instance.
                       // Vercel Hobby plan has limited concurrency for a single function.
    });

    // console.log("[DB_MONGO] Attempting to connect to MongoDB Atlas...");
    clientPromise = client.connect(); // client.connect() returns a promise
    await clientPromise; // Wait for the connection to establish

    console.log("[DB_MONGO] Successfully connected to MongoDB Atlas!");
    return { client, db: client.db() };

  } catch (error) {
    console.error("[DB_MONGO] Failed to connect to MongoDB:", error.message, error.stack);
    // Important: Nullify client and promise on failure so the next call attempts a fresh connection
    client = null;
    clientPromise = null;
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Ensures necessary indexes exist on the 'properties' collection.
 * In MongoDB, collections are created automatically on first insert.
 * This function focuses on index creation for query performance and uniqueness.
 * @param {object} keyMapping - The key mapping object where Object.values() gives DB field names.
 *                              This is used to identify fields like 'PropertyID' for unique indexing.
 */
export async function ensurePropertyCollectionIndexes(keyMapping) {
  if (!MONGODB_URI) {
    // console.warn("[DB_MONGO_INDEX] MONGODB_URI not set. Skipping index creation.");
    return; // Silently skip if not configured, or throw error if indexes are critical path
  }

  let mongoConnection; // To hold the { client, db } object
  try {
    mongoConnection = await getMongoClient(); // Get the shared/new client connection
    const propertiesCollection = mongoConnection.db.collection('properties');

    console.log("[DB_MONGO_INDEX] Ensuring indexes for 'properties' collection...");

    // --- Create a UNIQUE index on your main business identifier ---
    // This assumes your keyMapping maps something like "data.property.detail.id" to "PropertyID"
    // and "PropertyID" is the field name you want to be unique in MongoDB.
    const propertyIdFieldName = Object.values(keyMapping).find(
        dbFieldName => dbFieldName.toUpperCase() === 'PROPERTYID'
    );

    if (propertyIdFieldName) {
      await propertiesCollection.createIndex({ [propertyIdFieldName]: 1 }, { unique: true, background: true });
      console.log(`[DB_MONGO_INDEX] Unique index ensured for field '${propertyIdFieldName}'.`);
    } else {
      console.warn("[DB_MONGO_INDEX] Could not find 'PropertyID' in keyMapping values to create a unique index. This is highly recommended!");
    }

    // Example: Create other indexes for common query fields
    // const addressFieldName = Object.values(keyMapping).find(name => name.toLowerCase().includes('addresssingleline'));
    // if (addressFieldName) {
    //   await propertiesCollection.createIndex({ [addressFieldName]: 1 }, { background: true });
    //   console.log(`[DB_MONGO_INDEX] Index ensured for field '${addressFieldName}'.`);
    // }
    //
    // await propertiesCollection.createIndex({ CreatedAt: -1 }, { background: true }); // For sorting by creation time

    console.log("[DB_MONGO_INDEX] Index ensuring process completed.");
  } catch (error) {
    console.error("[DB_MONGO_INDEX] Error during index creation/ensuring:", error.message, error.stack);
    // Typically, you might not want to re-throw index creation errors if the app can function without them,
    // but log them prominently. If a unique index fails, data integrity could be at risk.
  }
  // DO NOT close the client here (mongoConnection.client.close()).
  // The client from getMongoClient() is meant to be reused for warm starts.
}

/**
 * Inserts or updates a property document in the 'properties' collection.
 * Uses MongoDB's upsert functionality based on a unique business key (e.g., PropertyID).
 * @param {object} propertyDataToInsert - The property data object. Keys should be the field names for MongoDB.
 * @param {object} keyMapping - The key mapping object, used to identify the unique business key field.
 */
export async function insertOrUpdateProperty(propertyDataToInsert, keyMapping) {
  if (!MONGODB_URI) {
    throw new Error("[DB_MONGO_UPSERT] MongoDB service is not configured: MONGODB_URI missing.");
  }

  // Determine the field name for your unique business key (e.g., "PropertyID")
  const uniqueBusinessKeyFieldName = Object.values(keyMapping).find(
    dbFieldName => dbFieldName.toUpperCase() === 'PROPERTYID'
  );

  if (!uniqueBusinessKeyFieldName) {
    console.error("[DB_MONGO_UPSERT] 'PropertyID' (or equivalent unique key) not found in keyMapping values. Cannot perform upsert.");
    throw new Error("Unique business key for upsert is not defined in keyMapping.");
  }
  if (!propertyDataToInsert[uniqueBusinessKeyFieldName]) {
    console.error(`[DB_MONGO_UPSERT] Value for unique key '${uniqueBusinessKeyFieldName}' is missing in propertyDataToInsert. Cannot perform upsert.`);
    throw new Error(`Missing value for unique key '${uniqueBusinessKeyFieldName}' in data.`);
  }

  // The query to find an existing document
  const query = { [uniqueBusinessKeyFieldName]: propertyDataToInsert[uniqueBusinessKeyFieldName] };

  // The data to set/update. Add/update an 'updatedAt' timestamp.
  const now = new Date(); // Use JavaScript Date objects for BSON Dates in MongoDB
  const updateDocument = {
    $set: {
      ...propertyDataToInsert, // Spread all fields from the input data
      updatedAt: now,
    },
    $setOnInsert: { // Fields to set only when a new document is inserted
      createdAt: now, // This will be a BSON Date if `now` is a JS Date
      // You could also add the PropertyID here if it's not always in propertyDataToInsert for some reason,
      // though it's better if propertyDataToInsert is complete.
      // [uniqueBusinessKeyFieldName]: propertyDataToInsert[uniqueBusinessKeyFieldName]
    }
  };

  let mongoConnection;
  try {
    mongoConnection = await getMongoClient();
    const propertiesCollection = mongoConnection.db.collection('properties');
    // console.log(`[DB_MONGO_UPSERT] Attempting upsert for ${uniqueBusinessKeyFieldName}: ${query[uniqueBusinessKeyFieldName]}`);
    const result = await propertiesCollection.updateOne(query, updateDocument, { upsert: true });
    const propertyIdForLog = propertyDataToInsert[uniqueBusinessKeyFieldName];
    if (result.upsertedCount > 0) {
      console.log(`[DB_MONGO_UPSERT] PropertyID ${propertyIdForLog} INSERTED. Document ID: ${result.upsertedId}`);
    } else if (result.modifiedCount > 0) {
      console.log(`[DB_MONGO_UPSERT] PropertyID ${propertyIdForLog} UPDATED. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    } else if (result.matchedCount > 0 && result.modifiedCount === 0) {
      console.log(`[DB_MONGO_UPSERT] PropertyID ${propertyIdForLog} matched but no data changed. Matched: ${result.matchedCount}`);
    } else if (result.matchedCount === 0 && result.upsertedCount === 0 && result.modifiedCount === 0) {
      console.warn(`[DB_MONGO_UPSERT] PropertyID ${propertyIdForLog}: No document matched, and no document was upserted or modified. This is unusual. Result:`, result);
    } else { // Should ideally be covered by above, but as a fallback
        console.log(`[DB_MONGO_UPSERT] Upsert operation for PropertyID ${propertyIdForLog} completed. Result:`, result);
    }
    return result;

  } catch (err) {
    const propertyIdForError = propertyDataToInsert?.[uniqueBusinessKeyFieldName] || 'Unknown ID during upsert error';
    console.error(`[DB_MONGO_UPSERT] Error in insertOrUpdateProperty for ${uniqueBusinessKeyFieldName} ${propertyIdForError}:`, err.message, err.stack);
    throw err;
  }
  // Again, DO NOT close mongoConnection.client here.
}

// Example of how you might want to gracefully close the MongoDB client when the Vercel function
// environment is about to be shut down (though Vercel doesn't offer explicit shutdown hooks for HTTP functions).
// This is more relevant for long-running processes or different types of serverless functions.
// For typical Vercel HTTP functions, relying on the driver to manage the pool and connections
// timing out naturally is usually sufficient.
// process.on('SIGTERM', async () => {
//   console.log('[DB_MONGO] SIGTERM received. Attempting to close MongoDB connection...');
//   if (client) {
//     await client.close();
//     console.log('[DB_MONGO] MongoDB connection closed.');
//   }
//   process.exit(0);
// });