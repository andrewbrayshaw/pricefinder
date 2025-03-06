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
console.log(process.env.API_KEY)
//let db;
//const connection = new SQLiteCloudConnection({
//  databaseURL: `sqlitecloud://ckwwhzstnk.g1.sqlite.cloud:8860/chinook.sqlite?apikey=9ftTMPmhwKGkOYLEe82SSGcWc0uggDdCbdtOrZKXLtI`
//  });
////const result = db.sql`SELECT * FROM <tablename>;`;
const db = new Database(`sqlitecloud://ckwwhzstnk.g1.sqlite.cloud:8860/pricefinder?apikey=${process.env.APIKEY}`)
// Ensure the table exists before handling requests
async function createTableIfNotExists() {
  try {
    // Execute the SQL query
    await db.sql`
    CREATE TABLE IF NOT EXISTS properties (
        ID INTEGER PRIMARY KEY AUTOINCREMENT, -- Automatically increments for each row
        CreatedAt DATE DEFAULT (CURRENT_DATE)
        propertyID INTEGER, -- Provided by external API
        Low_Estimate INTEGER, -- Whole number (no decimals)
        High_Estimate INTEGER, -- Whole number (no decimals)
        Estimate_Confidence TEXT, -- High, Medium, Low (stored as text)
        Valuation_Date DATE, -- Date format (YYYY-MM-DD)
        OtherDetails TEXT, -- Additional information (string)
        DaysOnMarket INTEGER, -- Whole number (days on market)
        ListedPrice INTEGER, -- Whole number (no decimals)
        Description TEXT, -- Description of the property
        LandArea INTEGER, -- Land area in square meters, for example
        LastSoldDate DATE, -- Date format (YYYY-MM-DD)
        LastSoldPrice INTEGER, -- Last sold price (whole number)
        LastSoldTranferID TEXT, -- Transfer ID of the last sale (string)
        Latitude REAL, -- Latitude (decimal)
        Longitude REAL -- Longitude (decimal)
      );`//`SELECT * FROM customers LIMIT 10;`;

    // Print the results
    console.log('Table "properties" is ready or already exists.');
  } catch (error) {
    console.error('Error creating table:', error);
  }
}
// Create the table when the application starts
createTableIfNotExists();

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
    // Insert the property data into the properties table
    await db.sql`
    INSERT INTO properties (
      CreatedAt, propertyID, Low_Estimate, High_Estimate, Estimate_Confidence, Valuation_Date,
      OtherDetails, DaysOnMarket, ListedPrice, Description, LandArea,
      LastSoldDate, LastSoldPrice, LastSoldTranferID, Latitude, Longitude
    )
    VALUES (
      CURRENT_DATE, 
      ${propertyData.propertyID}, ${propertyData.Low_Estimate}, ${propertyData.High_Estimate}, 
      ${propertyData.Estimate_Confidence}, ${propertyData.Valuation_Date}, 
      ${propertyData.OtherDetails}, ${propertyData.DaysOnMarket}, ${propertyData.ListedPrice}, 
      ${propertyData.Description}, ${propertyData.LandArea}, 
      ${propertyData.LastSoldDate}, ${propertyData.LastSoldPrice}, 
      ${propertyData.LastSoldTranferID}, ${propertyData.Latitude}, ${propertyData.Longitude}
    );
  `;
  console.log('New property inserted into the database');
  return response.json({ message: 'Property data inserted into the database', propertyData });
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
app.listen(3000, () => {
  console.log("Listening on port 3000")
})

