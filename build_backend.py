
import os
import sys
import shutil
import subprocess

def build_backend():
    """
    Instead of building the backend with PyInstaller, we'll just make sure
    the backend files are properly organized for packaging with Electron.
    """
    print("Preparing backend files for packaging...")
    
    # Get the backend directory path (one level up from current directory, then into 'backend')
    source_backend_dir = os.path.join(os.path.dirname(os.getcwd()), "backend")
    
    # Create a local backend directory for packaging
    backend_dir = os.path.join(os.getcwd(), "backend")
    if not os.path.exists(backend_dir):
        os.makedirs(backend_dir)
    
    # Check if source backend directory exists
    if not os.path.exists(source_backend_dir):
        print(f"Warning: Backend directory not found at {source_backend_dir}")
        return backend_dir
    
    # Copy all Python files and .env file from the backend directory
    backend_files = [f for f in os.listdir(source_backend_dir) if f.endswith('.py') or f == '.env']
    for file in backend_files:
        src_file = os.path.join(source_backend_dir, file)
        dest_file = os.path.join(backend_dir, file)
        shutil.copy2(src_file, dest_file)
        print(f"Copied {file} to local backend directory")
    
    # Copy requirements.txt if it exists
    req_file = os.path.join(source_backend_dir, "requirements.txt")
    if os.path.exists(req_file):
        shutil.copy2(req_file, os.path.join(backend_dir, "requirements.txt"))
        print("Copied requirements.txt to local backend directory")
    
    # We don't need PyInstaller, so we'll just return the path to our backend directory
    print("Backend preparation complete!")
    return backend_dir

if __name__ == "__main__":
    build_backend()
