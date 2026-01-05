# Create a new file named api_test.py and write the Python code to it
$pythonCode = @'
import requests
import json

# The URL of your running FastAPI backend
API_URL = "http://localhost:8000/process-frame"

# The path to the image you want to send
IMAGE_PATH = "test_image.jpg"

# (Optional) Add some fake SLAM coordinates
slam_data = {"x": 10.5, "y": -3.2}

print(f"--- Sending '{IMAGE_PATH}' to the Vision API ---")

try:
    # Prepare the files and data for the POST request
    files = {'file': (IMAGE_PATH, open(IMAGE_PATH, 'rb'), 'image/jpeg')}
    payload = {'slam_coordinates': json.dumps(slam_data)}

    # Send the request
    response = requests.post(API_URL, files=files, data=payload)

    # Check if the request was successful
    if response.status_code == 200:
        print("\n--- ✅ SUCCESS! Frame processed. ---")

        # Print the pretty-printed JSON response from the server
        response_data = response.json()
        print(json.dumps(response_data, indent=2))

        print(f"\nCheck your 'mission_logs' folder. A new entry and image should be there!")

    else:
        print(f"\n--- ❌ ERROR! Server responded with status code: {response.status_code} ---")
        print("Response content:")
        print(response.text)

except FileNotFoundError:
    print(f"ERROR: The file '{IMAGE_PATH}' was not found. Make sure it's in the same directory.")
except requests.exceptions.RequestException as e:
    print(f"ERROR: Could not connect to the API at {API_URL}.")
    print(f"Please make sure your 'main.py' server is running. Details: {e}")
'@

# Write the code to api_test.py
$pythonCode | Out-File -FilePath "api_test.py" -Encoding utf8

Write-Host "File 'api_test.py' has been created successfully."
