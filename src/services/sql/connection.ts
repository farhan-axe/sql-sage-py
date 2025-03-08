
/**
 * Functions for connecting to SQL Server
 */
import { ConnectionConfig } from "@/types/database";

/**
 * Connects to a SQL Server instance and retrieves available databases
 * @param config Connection configuration
 * @returns Promise that resolves to array of database names
 */
export const connectToServer = async (config: { 
  server: string; 
  useWindowsAuth: boolean; 
  username?: string; 
  password?: string; 
}): Promise<string[]> => {
  try {
    console.log("Connecting to server with config:", JSON.stringify({
      server: config.server,
      useWindowsAuth: config.useWindowsAuth,
      username: config.username ? '(provided)' : '(not provided)',
      // Don't log the password for security reasons
    }));
    
    // Explicitly use the correct URL with protocol and port
    const apiUrl = 'http://localhost:3001/api/sql/connect';
    
    console.log("Sending API request to:", apiUrl);
    
    // Add timeout to prevent hanging connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(config),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log("Server response status:", response.status);
    
    // Check if the response is HTML by looking at content-type header
    const contentType = response.headers.get('content-type');
    const isHtmlResponse = contentType && contentType.includes('text/html');
    
    if (isHtmlResponse) {
      throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. Make sure your backend API is running at ${apiUrl} and returning JSON responses.`);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response text:", errorText);
      
      // Check if the error response contains HTML (common for 404, 500, etc.)
      if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually indicates that the API server is not running or the endpoint doesn't exist. Make sure your backend API is running at ${apiUrl}.`);
      }
      
      let errorDetail;
      try {
        const errorData = JSON.parse(errorText);
        errorDetail = errorData.detail || errorData.message || 'Failed to connect to the server';
      } catch (e) {
        errorDetail = 'Failed to connect to the server: ' + errorText;
      }
      
      throw new Error(errorDetail);
    }
    
    const responseText = await response.text();
    console.log("Response text length:", responseText.length);
    console.log("Response text preview:", responseText.substring(0, 100));
    
    if (!responseText.trim()) {
      throw new Error('Empty response from server');
    }
    
    // Try to parse the response as JSON, with better error handling
    try {
      const data = JSON.parse(responseText);
      return data.databases || [];
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Please check if the API server is running correctly at http://localhost:3001 and configured to return JSON responses.`);
      }
      throw new Error(`Failed to parse server response as JSON. The server might not be returning valid JSON data. Response starts with: ${responseText.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('Error connecting to server:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Connection timed out after 30 seconds. Please check if the backend server is running at http://localhost:3001.');
    }
    throw error;
  }
};

/**
 * Terminates the current database session
 * @param server Server name
 * @param database Database name
 * @param useWindowsAuth Whether to use Windows Authentication
 * @param sqlAuth SQL Server Authentication credentials (optional)
 * @returns Promise that resolves to success status
 */
export const terminateSession = async (
  server: string,
  database: string,
  useWindowsAuth: boolean,
  sqlAuth?: { username: string; password: string }
): Promise<boolean> => {
  try {
    // Explicitly use the correct URL with protocol and port
    const apiUrl = 'http://localhost:3001/api/sql/terminate';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        server,
        database,
        useWindowsAuth,
        ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password }),
      }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error terminating session:', error);
    return false;
  }
};
