import urllib.request
import urllib.parse
import json
import csv
import time
import os

API_KEY = "AIzaSyACSDHoH2KuKZ_WTXbPsy26d9M5cEpv7No"
OUTPUT_CSV = os.path.join(os.path.dirname(__file__), "srinagar_mechanics.csv")

SEARCH_QUERIES = [
    "car mechanic in Srinagar",
    "auto repair shop in Srinagar",
    "car workshop in Srinagar",
    "bike mechanic in Srinagar",
    "car service center in Srinagar",
]

def text_search(query, page_token=None):
    params = {
        "query": query,
        "key": API_KEY,
    }
    if page_token:
        params["pagetoken"] = page_token
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def get_place_details(place_id):
    fields = "name,formatted_address,formatted_phone_number,international_phone_number,rating,user_ratings_total,opening_hours,website,geometry,business_status,types"
    params = {
        "place_id": place_id,
        "fields": fields,
        "key": API_KEY,
    }
    url = "https://maps.googleapis.com/maps/api/place/details/json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def main():
    seen_ids = set()
    all_places = []

    for query in SEARCH_QUERIES:
        print(f"\nSearching: {query}")
        page_token = None

        while True:
            if page_token:
                time.sleep(2)
            data = text_search(query, page_token)

            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                print(f"  API error: {data.get('status')} - {data.get('error_message', '')}")
                break

            results = data.get("results", [])
            print(f"  Found {len(results)} results")

            for place in results:
                pid = place["place_id"]
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)

                details_resp = get_place_details(pid)
                if details_resp.get("status") != "OK":
                    print(f"  Skipping {place.get('name')} - details error")
                    continue

                d = details_resp["result"]
                loc = d.get("geometry", {}).get("location", {})
                hours = d.get("opening_hours", {})

                entry = {
                    "name": d.get("name", ""),
                    "address": d.get("formatted_address", ""),
                    "phone": d.get("formatted_phone_number", ""),
                    "international_phone": d.get("international_phone_number", ""),
                    "rating": d.get("rating", ""),
                    "total_ratings": d.get("user_ratings_total", ""),
                    "website": d.get("website", ""),
                    "latitude": loc.get("lat", ""),
                    "longitude": loc.get("lng", ""),
                    "business_status": d.get("business_status", ""),
                    "types": ", ".join(d.get("types", [])),
                    "hours": " | ".join(hours.get("weekday_text", [])),
                }
                all_places.append(entry)
                print(f"  ✓ {entry['name']} — {entry['phone'] or 'no phone'}")

                time.sleep(0.1)

            page_token = data.get("next_page_token")
            if not page_token:
                break

    if not all_places:
        print("\nNo results found. Check your API key and ensure Places API is enabled.")
        return

    fieldnames = ["name", "address", "phone", "international_phone", "rating", "total_ratings", "website", "latitude", "longitude", "business_status", "types", "hours"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_places)

    print(f"\n{'='*50}")
    print(f"Done! {len(all_places)} mechanics saved to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
