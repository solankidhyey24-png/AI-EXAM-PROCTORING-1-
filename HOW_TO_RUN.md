# How to Run the AI Exam Proctoring System

To run the full system, you will need to open **three separate terminals** (PowerShell or Command Prompt).

## Prerequisites (First-Time Setup Only)
If this is your first time running the project, you must install the dependencies:

1. **Python Dependencies**:
   Open a terminal in the root directory, activate the virtual environment, and install libraries:
   ```powershell
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   pip install -r backend/requirements.txt
   ```
2. **Frontend Dependencies**:
   Open a terminal in the `frontend` folder and install:
   ```powershell
   cd frontend
   npm install
   ```

---

## Step 1: Start the Backend Server (API & Database)
This handles the database and the WebSocket connection between the AI client and the web browser.

1. **Open Terminal #1**                   
2. **Navigate to the project root directory**: 
   ```powershell
   cd "C:\Users\solan\OneDrive\Desktop\AI EXAM PROCTORING"
   ```
3. **Activate the Virtual Environment**:
   ```powershell
   .\.venv\Scripts\activate
   ```
4. **Start the FastAPI server**:
   ```powershell
   uvicorn backend.main:app --reload --app-dir .
   ```
   *(Keep this running! You should see `Uvicorn running on http://127.0.0.1:8000`)*

---

## Step 2: Start the Frontend App (React/Vite)
This serves both the Student Portal (for taking exams) and the Teacher Dashboard (for monitoring).

1. **Open Terminal #2**
2. **Navigate to the frontend folder**: 
   ```powershell
   cd "C:\Users\solan\OneDrive\Desktop\AI EXAM PROCTORING\frontend"
   ```
3. **Start the development server**:
   ```powershell
   npm run dev
   ```
4. **Access the application**: The terminal will display a local link (usually `http://localhost:5173/`).
   - Open this link in your browser to access the **Student Portal**.
   - Navigate to `http://localhost:5173/teacher-dashboard` (or the respective route) in another tab for the **Teacher Dashboard**.

---

## Step 3: Start the Desktop AI Monitoring Client
This is the Python script that monitors the student using their local webcam and processes frames with AI.

1. **Open Terminal #3**
2. **Navigate to the project root directory**:
   ```powershell
   cd "C:\Users\solan\OneDrive\Desktop\AI EXAM PROCTORING"
   ```
3. **Activate the Virtual Environment**:
   ```powershell
   .\.venv\Scripts\activate
   ```
4. **Release your Webcam**: If you gave your browser access to the webcam in Step 2 for a "Pre-Check", **navigate away from that page** to release the camera. Windows only allows one app to use the webcam at a time.
5. **Run the AI script**:
   ```powershell
   python main.py
   ```
6. **Enter Details**: The script will prompt you for your `Full Name` and `Exam Code`. Ensure these exact same details were entered in the browser frontend to link the sessions correctly.

