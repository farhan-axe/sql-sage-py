
import os
import sys
import platform

def find_backend_directory():
    """Search for the backend directory in various locations."""
    # Get the current directory (should be frontend/sql-sage-py)
    current_dir = os.getcwd()
    print(f"Current directory: {current_dir}")
    
    # User-specified path - check first based on error message
    user_specified = os.path.join(os.path.dirname(current_dir), "..", "backend")
    if os.path.exists(os.path.join(user_specified, "sql.py")):
        print(f"Found backend at user-specified location: {user_specified}")
        return user_specified
    
    # Try various potential locations for the backend
    potential_locations = [
        # Current directory / backend
        os.path.join(current_dir, "backend"),
        
        # Parent directory (frontend) / backend
        os.path.join(os.path.dirname(current_dir), "backend"),
        
        # Grandparent directory (project root) / backend
        os.path.join(os.path.dirname(os.path.dirname(current_dir)), "backend"),
        
        # One more level up / backend (in case of deeply nested structure)
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))), "backend"),
        
        # Explicit path with 'sqlbot' in it (based on error message)
        os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(current_dir)), "..", "backend")),
        
        # Another possible location mentioned by user
        os.path.abspath(os.path.join(os.path.dirname(current_dir), "..", "sqlbot", "backend")),
    ]
    
    # Print all paths we're going to check
    print("Searching for backend directory in these locations:")
    for idx, location in enumerate(potential_locations):
        print(f"  {idx+1}. {location}")
    
    # Check each location
    for location in potential_locations:
        if os.path.exists(location):
            # Check if this directory has sql.py to confirm it's the backend
            if os.path.exists(os.path.join(location, "sql.py")):
                print(f"Found backend directory at: {location}")
                return location
            else:
                print(f"Directory exists but doesn't contain sql.py: {location}")
    
    # If a specific path was mentioned by the user, try to handle that
    if os.path.exists(os.path.join(os.path.dirname(os.path.dirname(current_dir)), "..", "sqlbot", "backend")):
        backend_dir = os.path.join(os.path.dirname(os.path.dirname(current_dir)), "..", "sqlbot", "backend")
        print(f"Found backend at user-specified location: {backend_dir}")
        return backend_dir
    
    # Try by asking the user for the path (if this is an interactive session)
    if hasattr(sys, 'ps1') or sys.stdout.isatty():
        print("\nCould not automatically find the backend directory.")
        user_path = input("Please enter the full path to the backend directory: ")
        if os.path.exists(user_path) and os.path.exists(os.path.join(user_path, "sql.py")):
            print(f"Using user-provided backend path: {user_path}")
            return user_path
    
    print("\nWARNING: Could not find backend directory. Please make sure it exists and contains sql.py")
    print("The application may not function correctly without the backend files.")
    
    # Return None if we can't find it
    return None
