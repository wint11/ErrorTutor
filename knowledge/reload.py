import requests
import sys

API_URL = "http://localhost:8001/reload_config"

def reload_config():
    print(f"Sending reload request to {API_URL}...")
    try:
        response = requests.post(API_URL)
        if response.status_code == 200:
            print("✅ Success! Configuration reloaded.")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Failed. Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error connecting to server: {e}")
        print("Make sure the service is running (python service.py)")

if __name__ == "__main__":
    reload_config()
