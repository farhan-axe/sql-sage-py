
# SQL Sage with Ollama and DeepSeek Integration

This application requires Ollama to be installed and running with DeepSeek R1 model to generate SQL queries.

## Prerequisites

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the DeepSeek R1 model:

```bash
ollama pull deepseek-r1:8b
```

Alternatively, you can pull a larger model for better performance:

```bash
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

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Start Ollama:
   ```bash
   ollama serve
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

1. Start Ollama (must be running before launching the application)
   ```bash
   ollama serve
   ```

2. Run the SQL Sage application

## Troubleshooting

- If you encounter errors with Ollama, ensure that the Ollama service is running:
  ```bash
  ollama serve
  ```
  
- If you get "Connection refused" errors, ensure Ollama is running on the default port (11434).

- For model-specific errors, try using a different DeepSeek model variant:
  - deepseek-r1:8b (smaller, faster)
  - deepseek-r1:14b (larger, more accurate)

- If the application shows an error about Python or the backend process, make sure Python is installed
  and that your environment has the required packages (fastapi, uvicorn, etc.).

## Important Notes

1. The backend requires Ollama to be running to generate SQL queries.
2. If a non-database question is asked (like "who is the president of Pakistan"), the application will detect it and return an error message.
3. Internet connection is NOT required once Ollama and the models are installed.
