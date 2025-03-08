
import uvicorn
from api_routes import app
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting SQL Server API server...")
    uvicorn.run(app, host="0.0.0.0", port=3001)
