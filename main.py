
import uvicorn
from api_routes import app
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    # Get port from environment variable or use default
    port = int(os.getenv("PORT", "3001"))
    logger.info(f"Starting SQL Server API server on port {port}...")
    # When packaging with PyInstaller, we need to set the host to localhost
    uvicorn.run(app, host="0.0.0.0", port=port)
