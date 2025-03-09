
# Make the directory a proper package
from .path_finder import find_backend_directory
from .environment import detect_conda_environment, find_python_executable
from .launcher import create_backend_launcher
from .ollama import check_ollama_running

# Keep the main function accessible at the package level
from .build import build_backend

__all__ = [
    'find_backend_directory',
    'detect_conda_environment',
    'find_python_executable',
    'create_backend_launcher',
    'check_ollama_running',
    'build_backend'
]
