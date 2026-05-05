import requests, os

# Create dummy image
with open('dummy.png', 'wb') as f:
    f.write(b"fake image content")

url = "http://127.0.0.1:8000/upload_evidence"
payload = {'student_id': '17', 'exam_id': '8', 'event_type': 'Looking Away'}
files = {'image': ('dummy.png', open('dummy.png', 'rb'), 'image/png')}

print("Sending request...")
response = requests.post(url, data=payload, files=files)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")

# Clean up
os.remove('dummy.png')
