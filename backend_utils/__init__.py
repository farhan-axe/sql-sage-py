
# Make the directory a proper package
from .path_finder import find_backend_directory
from .environment import detect_conda_environment, find_python_executable
from .launcher import create_backend_launcher
from .ollama import check_ollama_running, create_ollama_instructions
from .npm import find_npm
from .frontend import build_frontend
from .electron import setup_electron, build_electron_app, restore_package_json
from .package_app import package_application

# Keep the main function accessible at the package level
from .build import build_backend

__all__ = [
    'find_backend_directory',
    'detect_conda_environment',
    'find_python_executable',
    'create_backend_launcher',
    'check_ollama_running',
    'create_ollama_instructions',
    'find_npm',
    'build_frontend',
    'setup_electron',
    'build_electron_app',
    'restore_package_json',
    'package_application',
    'build_backend'
]
