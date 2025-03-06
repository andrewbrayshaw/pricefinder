import express from "express"
import cors from "cors"
import fetch from 'node-fetch'
import { Database, SQLiteCloudConnection } from '@sqlitecloud/drivers';

const app = express()
var whitelist = process.env.whitelist
var corsOptions = {
  origin: whitelist,
  credentials: true
};
app.use(express.urlencoded({ extended: true }))
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.text())
app.use(express.static('public'))
//const db = new Database(process.env.DATABASE_URL)

const db = new Database(process.env.DATABASE_URL)

const fetchAlbums = async () => await db.sql`USE DATABASE chinook.sqlite; SELECT * FROM albums;`;

fetchAlbums().then((albums) => console.log(albums));

//async function connectToDb() {
//  if (!db || !await db.isConnected()) {
//    try {
//      db = new Database(process.env.DATABASE_URL);
//      // Since SQLiteCloud automatically connects when you make a query,
//      // you don't need to manually connect, but let's ensure the connection is valid.
      //await db.sql('SELECT *'); // Just making a simple query to check the connection.
//      console.log("Connected to the database");
//    } catch (error) {
//      console.error("Error during the connection:", error);
//      throw error;  // Rethrow the error after logging it
//    }
//  }
//  return db;
//}
// Ensure the table exists before handling requests
//async function createTableIfNotExists() {
 // try {
    // Execute the SQL query
 //   await connectToDb()
 //   await db.sql`
 //   CREATE TABLE IF NOT EXISTS properties (
  //      ID INTEGER PRIMARY KEY AUTOINCREMENT, -- Automatically increments for each row
   //     CreatedAt DATE DEFAULT (CURRENT_DATE)
    //    propertyID INTEGER, -- Provided by external API
    //    Low_Estimate INTEGER, -- Whole number (no decimals)
     //   High_Estimate INTEGER, -- Whole number (no decimals)
      //  Estimate_Confidence TEXT, -- High, Medium, Low (stored as text)
       // Valuation_Date DATE, -- Date format (YYYY-MM-DD)
      //  OtherDetails TEXT, -- Additional information (string)
     //   DaysOnMarket INTEGER, -- Whole number (days on market)
    ///    ListedPrice INTEGER, -- Whole number (no decimals)
   //     Description TEXT, -- Description of the property
   //     LandArea INTEGER, -- Land area in square meters, for example
   //     LastSoldDate DATE, -- Date format (YYYY-MM-DD)
   //     LastSoldPrice INTEGER, -- Last sold price (whole number)
  //      LastSoldTranferID TEXT, -- Transfer ID of the last sale (string)
  //      Latitude REAL, -- Latitude (decimal)
  //      Longitude REAL -- Longitude (decimal)
  //    );`//`SELECT * FROM customers LIMIT 10;`;

    // Print the results
    //console.log('Table "properties" is ready or already exists.');
 // } catch (error) {
 //   console.error('Error creating table:', error);
 // }/
//}
// Create the table when the application starts
//createTableIfNotExists();

app.get('/CoreLogic/:address', async (request, response) => {
  const address = request.params.address
  console.log("Request received for ", address)
  const api_url = `https://digital-api.stgeorge.com.au/property-insights?q=${address}`;
  
  try {
    const fetch_response = await fetch(api_url);
    const json = await fetch_response.json();

    // Check if json.data and json.data.results exist and are not empty
    if (!json.data || !json.data.results || json.data.results.length === 0 || json.data.results == null) {
      console.log("No results found for the address.");
      return response.status(404).json({ message: "No results found for the address" });
    }

    // Proceed with accessing the first result since it's guaranteed to exist
    const add_id = json.data.results[0]?.propertyId;
    if (!add_id) {
      console.log("Property ID not found");
      return response.status(400).json({ message: "Property ID not found" });
    }
    console.log("Property ID:", add_id);

    const api_url2 = `https://digital-api.stgeorge.com.au/property-insights/property/${add_id}?` //add_id}?`
    const fetch_response2 = await fetch(api_url2);
    const json2 = await fetch_response2.json();
    const avm = json2.data.property.detail.avm
    const attributes = json2.data.property.detail.attributes
    const results = json2.data || []; // Ensure results is at least an empty array
    // Check if there is at least one result
    const saleHistory = json2?.data?.property?.detail?.saleHistory || [];
    const listingHistory = json2?.data?.property?.listingHistory || {};
    //Changed from return response.json to const propertyData below
    const propertyData = {
      propertyID: json.data.results[0].propertyId,
      Low_Estimate: avm?.estimateLow || "N/A",
      High_Estimate: avm?.estimateHigh || "N/A",
      Estimate_Confidence: avm?.confidenceLevel || "N/A",
      Valuation_Date: avm?.valuationDate || "N/A",
      OtherDetails: json2.data.property.detail || "N/A",
      DaysOnMarket: listingHistory?.[0]?.daysOnMarket || "N/A",
      ListedPrice: listingHistory?.[0]?.latestPrice || "N/A",
      Description: listingHistory?.[0]?.priceDescription || "N/A",
      LandArea: attributes?.landArea || "N/A",
      LastSoldDate: saleHistory?.[0]?.settlementDate || "N/A",
      LastSoldPrice: saleHistory?.[0]?.price || "N/A",
      LastSoldTranferID: saleHistory?.[0]?.transferId || "N/A",     
      Latitude: json2.data.property.detail.geolocation.latitude,
      Longitude: json2.data.property.detail.geolocation.longitude
    };
    // Send the response to the client immediately
    response.json({
      message: 'Property data received and inserted into the database',
      propertyData
    });

    // Now proceed to insert data into the database asynchronously after the response has been sent
    // This operation is done asynchronously, so it doesn't block the response to the client
    
export default app;

