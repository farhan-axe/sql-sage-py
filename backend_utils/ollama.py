
"""
Module for Ollama-related operations.
"""
import socket

def check_ollama_running(host="localhost", port=11434):
    """Check if Ollama server is running by attempting to connect to its port."""
    try:
        # Try to create a socket connection to the Ollama server
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)  # Set a timeout for the connection attempt
            result = s.connect_ex((host, port))
            return result == 0  # If result is 0, the connection was successful
    except:
        return False  # Any exception means Ollama is not accessible

def create_ollama_instructions():
    """Create instructions for setting up Ollama."""
    instructions = """
SQL Sage - Ollama Setup Instructions
====================================

Before running SQL Sage, you need to install Ollama and download the required model:

1. Download and install Ollama from https://ollama.ai

2. Open a terminal/command prompt and run:
   ollama pull deepseek-r1:8b

   (For better performance, you can use the larger model):
   ollama pull deepseek-r1:14b

3. Make sure Ollama is running before launching SQL Sage.
   On Windows, you should see the Ollama icon in your system tray.
   On macOS, Ollama should appear in your menu bar.
   On Linux, run 'ollama serve' if it's not already running.

4. You can customize the model by editing the .env file in the application directory.

IMPORTANT FOR CONDA USERS:
SQL Sage looks for a Python installation to run its backend. If you're using Conda,
make sure your 'sqlbot' environment is activated before running SQL Sage.
If you still encounter issues, you can edit the 'backend/run_backend.py' file
to specify your Python executable path directly.
"""
    
    with open("OLLAMA_SETUP.txt", "w") as f:
        f.write(instructions)
    
    return "OLLAMA_SETUP.txt"
