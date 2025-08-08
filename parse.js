import pandas as pd
from geopy.geocoders import Nominatim
import time

# Load the CSV
df = pd.read_csv('datall.csv')

# Function to geocode an address
def geocode_address(row):
    address = f"{row['Address']}, {row['City']}, {row['State']} {row['Zip']}"
    geolocator = Nominatim(user_agent="geoapiExercises")
    try:
        location = geolocator.geocode(address)
        if location:
            return pd.Series([location.latitude, location.longitude])
    except Exception as e:
        print(f"Error geocoding {address}: {e}")
    return pd.Series([row['Lat'], row['Lon']])  # Return existing values if geocoding fails

# Find rows with missing Lat or Lon
mask = df['Lat'].isnull() | df['Lon'].isnull()

# Process only those rows
for idx in df[mask].index:
    df.loc[idx, ['Lat', 'Lon']] = geocode_address(df.loc[idx])
    time.sleep(1)  # Be polite to the geocoding service

# Write back to the same file
df.to_csv('datall.csv', index=False)