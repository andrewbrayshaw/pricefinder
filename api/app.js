import express from "express"
import cors from "cors"
import fetch from 'node-fetch'
import { keyMapping } from '../lib/config/keyMappings.js';
import { insertOrUpdateProperty, ensurePropertyCollectionIndexes } from '../lib/services/databaseService.js'
import { buildPropertyData } from '../lib/services/dataTransformer.js';
import { Database } from "@sqlitecloud/drivers"; // For one-time table creation
import { MongoClient, ServerApiVersion } from "mongodb"

const app = express()
var whitelist = process.env.whitelist
var corsOptions = {
  origin: whitelist,
  credentials: true
};
app.use(express.urlencoded({ extended: true }))
app.use(cors(corsOptions))
//app.use(express.json())
//app.use(express.text())
//app.use(express.static('public'))
//console.log(process.env.SQLURL)

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

let mongoIndexesEnsured = false;
let ensureMongoIndexesInProgress = false;

async function performInitialMongoSetup() {
    if (mongoIndexesEnsured || ensureMongoIndexesInProgress) {
        return; // Already done or in progress for this warm instance
    }
    const MONGODB_URI = process.env.MONGODB_URI 
    if (!MONGODB_URI) { // Check if MongoDB is configured before attempting setup
        console.warn("[MONGO_SETUP_HANDLER] MONGODB_URI not set. Skipping MongoDB index creation.");
        return;
    }
    ensureMongoIndexesInProgress = true;
    console.log("[MONGO_SETUP_HANDLER] Attempting one-time MongoDB index creation/check...");
    try {
        // Pass the keyMapping so ensurePropertyCollectionIndexes knows which field
        // corresponds to "PropertyID" (or your unique business key) for the unique index.
        await ensurePropertyCollectionIndexes(keyMapping);
        mongoIndexesEnsured = true;
        console.log("[MONGO_SETUP_HANDLER] MongoDB index creation/check completed successfully.");
    } catch (error) {
        console.error("[MONGO_SETUP_HANDLER] Failed one-time MongoDB index creation/check:", error.message, error.stack);
        // mongoIndexesEnsured remains false, will retry on next suitable invocation of a new/recycled instance
    } finally {
        ensureMongoIndexesInProgress = false;
    }
}
app.get('/CoreLogic/:address', async (request, response) => {
  const address = request.params.address
  console.log("Request received for ", address)
  const api_url = `https://digital-api.stgeorge.com.au/property-insights?q=${address}`;
  await performInitialMongoSetup();
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
    const propertyID = json.data.results[0]?.propertyId;
    //const add_id = fetch_response.data.results[0]?.propertyId;
    if (!propertyID) {
      //console.log("Property ID not found");
      return response.status(400).json({ message: "Property ID not found" });
    }
    console.log("Property ID:", propertyID);

    const api_url2 = `https://digital-api.stgeorge.com.au/property-insights/property/${propertyID}?` //add_id}?`
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
    // *** MODIFICATION: Call and await insertProperty BEFORE sending response ***
  
    // Pass the transformed data and the keyMapping
    // The keyMapping's values are used by insertProperty to pick values from dataForDatabaseInsert
    //await createTableIfNotExists(dbInstance, coreLogicApiToDbKeyMap);
    const MONGODB_URI = process.env.MONGODB_URI
    if (MONGODB_URI) {
      try {
        console.log(`Attempting MongoDB upsert for ${propertyID}... (after client response, will await).`);
        await insertOrUpdateProperty(propertyData, keyMapping)
        console.log(`MongoDB upsert successful (awaited) for ...`);
      } catch (dbError) {
        // This error won't go to the client, as response is already sent.
        console.error(`MongoDB upsert FAILED (awaited) for ${propertyID}...:`, dbError.message, dbError.stack);
      }
    }
  
    response.status(200).json({ message: 'Property data fetched', propertyData });
 } catch (error) {
    console.error("Error fetching data:", error);
    return response.status(500).json({ message: "Internal Server Error" });
}
})

export default app