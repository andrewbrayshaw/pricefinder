import express from "express"
import cors from "cors"
import fetch from 'node-fetch'

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
    return response.json({
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
    })
  } catch (error) {
    console.error("Error fetching data:", error);
    return response.status(500).json({ message: "Internal Server Error" });
  }
});

// Export your app to be used by Vercel
export default app;  

//app.listen(3000, () => {
//  console.log("Listening on port 3000")
//})

