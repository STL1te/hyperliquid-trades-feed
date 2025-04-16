import http from "http";

/**
 * Healthcheck helper that sets up a healthcheck endpoint
 * @returns {http.Server} The HTTP server instance
 */
export const healthcheck = (): http.Server => {
  // Create a simple HTTP server for health check
  const server = http.createServer((req, res) => {
    // Set CORS headers for broader access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");

    // Return different responses based on the path
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "OK",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  // Listen on port 3000
  server.listen(3000, () => {
    console.log('Health endpoint is running on port 3000 - path: "/"');
  });

  return server; // Return the server instance
};
