
import os
import sys
import shutil
import subprocess

def build_backend():
    """
    This function is maintained for compatibility but now just returns
    the path to the backend folder as we're directly using the Python files.
    """
    print("Using existing backend files instead of building an executable...")
    
    # Create the backend directory in the current working directory if it doesn't exist
    backend_dir = os.path.join(os.getcwd(), "backend")
    if not os.path.exists(backend_dir):
        os.makedirs(backend_dir)
    
    print("Backend setup complete!")
    return backend_dir

if __name__ == "__main__":
    build_backend()
