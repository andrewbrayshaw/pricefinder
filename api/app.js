import express from "express"
import cors from "cors"
import fetch from 'node-fetch'
import { keyMapping } from '../lib/config/keyMappings.js';
import { insertProperty, createTableIfNotExists } from '../lib/services/databaseService.js'
import { buildPropertyData } from '../lib/services/dataTransformer.js';
import { Database } from "@sqlitecloud/drivers"; // For one-time table creation

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


let tableEnsured = false;
let isDbConnectionHealthy = true; // A flag to track DB health within this instance
async function ensureTableSchema() {
  // If we've already successfully ensured the table, or we know the DB is unhealthy, skip.
  if (tableEnsured || !isDbConnectionHealthy) {
      return;
  }
  if (!process.env.DATABASE_URL) {
        console.log("[DB_SETUP] DATABASE_URL is not set. Skipping schema check.");
        isDbConnectionHealthy = false; // Can't connect without a URL
        return;
  }
  console.log("Performing one-time table schema check/creation...");
  //let dbInstance = null;
  //if (!tableEnsured && process.env.DATABASE_URL) {
     //console.log("Performing one-time table schema check/creation...");
   //  let dbInstance = null;
   try {
       dbInstance = new Database(process.env.DATABASE_URL, { timeout: 15000, tls: { rejectUnauthorized: true } });
       const dbName = process.env.SQLITECLOUD_DB_NAME //|| "pricefinder";
       await dbInstance.sql(`USE DATABASE ${dbName};`);
       await createTableIfNotExists(dbInstance, keyMapping);
       tableEnsured = true; // Mark as ensured for this warm instance
       console.log("One-time table schema check/creation completed.");
   } catch (error) {
       console.error("Failed one-time table schema check/creation:", error);
       // tableEnsured remains false, will retry on next suitable invocation
       isDbConnectionHealthy = false; 
   } finally {
       if (dbInstance) await dbInstance.close();
   }
 }
}

app.get('/CoreLogic/:address', async (request, response) => {
  const address = request.params.address
  console.log("Request received for ", address)
  const api_url = `https://digital-api.stgeorge.com.au/property-insights?q=${address}`;
  //await ensureTableSchema(); // Attempt to ensure table exists (best effort for serverless)
  try {
    await ensureTableSchema(); // Attempt to ensure table exists (best effort for serverless)
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
    // *** MODIFICATION: Call and await insertProperty BEFORE sending response ***
    if (isDbConnectionHealthy){
      try {
        // The insertProperty function has its own connection logic. 
        // If the DB is down, it will throw an error here.
        await insertProperty(propertyData, keyMapping); 
        console.log("Database insertion process completed successfully for PropertyID:", propertyData.PropertyID || add_id);
      } catch (dbError) {
        // THIS IS THE KEY PART FOR SKIPPING.
        // We catch the error from insertProperty, log it, and move on.
        // We do NOT `return` or `throw` here.
        console.error("Failed to insert property data into database for PropertyID:", (propertyData.PropertyID || add_id), dbError.message);
      }
    } else {
        console.log('Skipping database insert due to earlier connection failure.')'
    }
  
    response.status(200).json({ message: 'Property data fetched', propertyData });
 } catch (error) {
    console.error("Error fetching data:", error);
    return response.status(500).json({ message: "Internal Server Error" });
}
})

export default app
