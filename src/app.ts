import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { itemRoutes, reservationRoutes, maintenanceRoutes } from "./routes";
import { errorHandler } from "./middleware";

const app = express();

app.use(express.json());

// Swagger UI at /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
