
# SQL Sage with Ollama and DeepSeek Integration

This application requires Ollama to be installed and running with DeepSeek R1 model to generate SQL queries.

## Prerequisites

1. **Python Requirements**
   - A working Python installation (Python 3.8 or higher)
   - On Windows, make sure Python is added to your PATH
   - If using conda, make sure you have activated your environment

2. **Ollama Setup**
   - Install Ollama from [ollama.ai](https://ollama.ai)
   - Pull the DeepSeek R1 model:

   ```bash
   # Pull the base 8B model (faster, less resources needed)
   ollama pull deepseek-r1:8b

   # OR pull the larger model for better performance
   ollama pull deepseek-r1:14b
   ```

## Configuration

You can customize the model used by:

1. Changing the model in the `.env` file:
   ```
   OLLAMA_MODEL=deepseek-r1:14b
   ```

2. When using the packaged executable, you can create a `.env` file in the same directory as the executable.

## Running the Application

### Development Mode

1. Start Ollama first:
   ```bash
   ollama serve
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the backend:
   ```bash
   python main.py
   ```

4. Start the frontend in another terminal:
   ```bash
   npm run dev
   ```

### Using Executables

1. Make sure Python is properly installed on your system
   - Test with `python --version` or `python3 --version`
   - If using Windows, ensure Python is in your PATH environment variable

2. Start Ollama (must be running before launching the application)
   ```bash
   ollama serve
   ```

3. Run the SQL Sage application

## Troubleshooting

### Python Issues

- If you see "Failed to start the SQL Sage backend: spawn python ENOENT" or similar:
  - Make sure Python is installed and in your PATH
  - Try running `python --version` in a terminal to verify it works
  - On Windows, you may need to reinstall Python and check "Add Python to PATH" during installation

- For Conda users:
  - If you're using a conda environment (like "sqlbot"), you might need to deactivate it before running the packaging script:
    ```
    conda deactivate
    python package_app.py
    ```
  - Alternatively, ensure your base Python is properly configured in PATH

- If packages are missing, manually install them:
  ```bash
  pip install fastapi uvicorn pyodbc requests python-dotenv
  ```

### Ollama Issues

- If you encounter errors with Ollama, ensure that the Ollama service is running:
  ```bash
  ollama serve
  ```
  
- If you get "Connection refused" errors, ensure Ollama is running on the default port (11434).

- For model-specific errors, try using a different DeepSeek model variant:
  - deepseek-r1:8b (smaller, faster)
  - deepseek-r1:14b (larger, more accurate)

### General Troubleshooting

- Check for error logs in the backend directory
- Restart both Ollama and the SQL Sage application
- If all else fails, try restarting your computer

## Important Notes

1. The backend requires Ollama to be running to generate SQL queries.
2. If a non-database question is asked (like "who is the president of Pakistan"), the application will detect it and return an error message.
3. Internet connection is NOT required once Ollama and the models are installed.
