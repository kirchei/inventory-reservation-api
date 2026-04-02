import express from "express";
import { swaggerSpec } from "./config/swagger";
import { itemRoutes, reservationRoutes, maintenanceRoutes } from "./routes";
import { errorHandler } from "./middleware";

const app = express();

app.use(express.json());

// Swagger UI at /docs (CDN-hosted assets for serverless compatibility)
app.get("/docs", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Inventory Reservation API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`);
});

// OpenAPI JSON at /openapi.json
app.get("/openapi.json", (_req, res) => {
  res.json(swaggerSpec);
});

// API routes
app.use("/v1/items", itemRoutes);
app.use("/v1/reservations", reservationRoutes);
app.use("/v1/maintenance", maintenanceRoutes);

// Root redirect to docs
app.get("/", (_req, res) => {
  res.redirect("/docs");
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Error handling (must be last)
app.use(errorHandler);

export default app;
