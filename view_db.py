import sqlite3
import os

def view_violations():
    db_path = "exam_monitor.db"
    
    if not os.path.exists(db_path):
        print(f"Error: Database file '{db_path}' not found.")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Query to get the latest 10 violations
        query = """
        SELECT id, student_id, event_type, suspicion_score, timestamp 
        FROM violations 
        ORDER BY timestamp DESC 
        LIMIT 10
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        print("\n=== LATEST VIOLATIONS ===")
        print(f"{'ID':<5} | {'Student':<8} | {'Event':<15} | {'Score':<6} | {'Timestamp'}")
        print("-" * 70)
        
        for row in rows:
            print(f"{row[0]:<5} | {row[1]:<8} | {row[2]:<15} | {row[3]:<6} | {row[4]}")
            
        if not rows:
            print("No violations found yet.")
            
        conn.close()
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    view_violations()
    
