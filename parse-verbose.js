import fs from 'fs/promises';
import Papa from 'papaparse';
import fetch from 'node-fetch';

// Read the CSV file
console.log('Reading datall.csv...');
const fileContent = await fs.readFile('datall.csv', { encoding: 'utf8' });
console.log('CSV file read successfully. Parsing...');

const parsedData = Papa.parse(fileContent, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: true,
});

console.log(`Parsed ${parsedData.data.length} rows.`);

// Helper to geocode an address using Nominatim
async function geocodeAddress(address) {
  console.log(`Geocoding address: "${address}"`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'geodata-script/1.0' }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      console.log(`Found coordinates: lat=${data[0].lat}, lon=${data[0].lon}`);
      return {
        lat: data[0].lat,
        lon: data[0].lon
      };
    }
    console.log('No coordinates found.');
    return { lat: '', lon: '' };
  } catch (err) {
    console.error('Error geocoding address:', err);
    return { lat: '', lon: '' };
  }
}

// Process rows: skip those with Lat/Lon, geocode those missing
let updatedCount = 0;
for (let i = 0; i < parsedData.data.length; i++) {
  const row = parsedData.data[i];
  const hasLat = row.Latitude && row.Latitude !== '';
  const hasLon = row.Longitude && row.Longitude !== '';
  if (!hasLat || !hasLon) {
    const address = `${row.City}, ${row.State || ''}, ${row['Country '] || ''}`;
    const { lat, lon } = await geocodeAddress(address);
    row.Latitude = lat;
    row.Longitude = lon;
    updatedCount++;
    // Write back to the file after each update
    const cleanedCSV = Papa.unparse(parsedData.data, { header: true });
    await fs.writeFile('datall.csv', cleanedCSV, { encoding: 'utf8' });
    console.log(`Row ${i + 1} updated and datall.csv saved.`);
    // Be polite to the geocoding service
    await new Promise(res => setTimeout(res, 1000));
  } else {
    console.log(`Row ${i + 1} already has Lat/Lon, skipping.`);
  }
}

console.log(`Updated ${updatedCount} rows with missing Lat/Lon.`);
console.log('Final datall.csv written successfully.');