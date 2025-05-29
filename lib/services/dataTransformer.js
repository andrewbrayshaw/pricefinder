import { keyMapping, excludeKeys } from '../keyMappings.js';


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
export function buildPropertyData(json) {
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