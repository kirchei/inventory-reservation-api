import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory Reservation API",
      version: "1.0.0",
      description:
        "API for managing inventory items and temporary reservations with concurrency-safe operations",
    },
    servers: [
      {
        url: "/",
        description: "Current server",
      },
    ],
    tags: [
      { name: "Items", description: "Inventory item management" },
      { name: "Reservations", description: "Reservation lifecycle" },
      { name: "Maintenance", description: "System maintenance operations" },
    ],
    paths: {
      "/v1/items": {
        post: {
          summary: "Create a new inventory item",
          tags: ["Items"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "initial_quantity"],
                  properties: {
                    name: { type: "string", example: "White T-Shirt" },
                    initial_quantity: {
                      type: "integer",
                      minimum: 1,
                      example: 5,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Item created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: { $ref: "#/components/schemas/ItemResponse" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/v1/items/{id}": {
        get: {
          summary: "Get item status with computed quantities",
          tags: ["Items"],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Item UUID",
            },
          ],
          responses: {
            "200": {
              description: "Item status retrieved",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: { $ref: "#/components/schemas/ItemResponse" },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Item not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/v1/reservations": {
        post: {
          summary: "Create a reservation (temporary hold)",
          tags: ["Reservations"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["item_id", "customer_id", "quantity"],
                  properties: {
                    item_id: {
                      type: "string",
                      format: "uuid",
                      example: "550e8400-e29b-41d4-a716-446655440000",
                    },
                    customer_id: { type: "string", example: "customer-123" },
                    quantity: { type: "integer", minimum: 1, example: 3 },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Reservation created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        $ref: "#/components/schemas/ReservationResponse",
                      },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Item not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "409": {
              description: "Insufficient inventory",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/v1/reservations/{id}/confirm": {
        post: {
          summary: "Confirm a reservation (permanently deduct inventory)",
          tags: ["Reservations"],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Reservation UUID",
            },
          ],
          responses: {
            "200": {
              description: "Reservation confirmed (idempotent)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        $ref: "#/components/schemas/ReservationResponse",
                      },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Reservation not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "409": {
              description: "Invalid state transition (expired or cancelled)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/v1/reservations/{id}/cancel": {
        post: {
          summary: "Cancel a reservation (release held inventory)",
          tags: ["Reservations"],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Reservation UUID",
            },
          ],
          responses: {
            "200": {
              description: "Reservation cancelled (idempotent)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        $ref: "#/components/schemas/ReservationResponse",
                      },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Reservation not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "409": {
              description: "Invalid state transition (already confirmed)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/v1/maintenance/expire-reservations": {
        post: {
          summary: "Expire stale pending reservations and release inventory",
          tags: ["Maintenance"],
          responses: {
            "200": {
              description: "Expired reservations processed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: {
                        type: "object",
                        properties: {
                          expired_count: { type: "integer", example: 3 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ItemResponse: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            total_quantity: { type: "integer" },
            available_quantity: { type: "integer" },
            reserved_quantity: { type: "integer" },
            confirmed_quantity: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ReservationResponse: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            item_id: { type: "string", format: "uuid" },
            customer_id: { type: "string" },
            quantity: { type: "integer" },
            status: {
              type: "string",
              enum: ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"],
            },
            created_at: { type: "string", format: "date-time" },
            expires_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
