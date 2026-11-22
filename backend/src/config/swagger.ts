import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Universal Gaming Knowledge Agent API",
      version: "1.0.0",
      description:
        "Phase 1 backend foundation for the Universal Gaming Knowledge Agent — REST API for health checks and game metadata.",
    },
    servers: [
      {
        url: "/api",
        description: "API base path",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        UserProfile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            username: { type: "string" },
            email: { type: "string", format: "email" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/UserProfile" },
                token: { type: "string" },
              },
            },
          },
        },
        Conversation: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            title: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ConversationMessage: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            conversationId: { type: "string", format: "uuid" },
            role: { type: "string", enum: ["user", "assistant", "system"] },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            totalCount: { type: "integer", minimum: 0 },
            totalPages: { type: "integer", minimum: 0 },
          },
        },
        CreateConversationInput: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 200 },
          },
        },
        Game: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            slug: { type: "string" },
            description: { type: "string", nullable: true },
            releaseDate: { type: "string", format: "date-time", nullable: true },
            developer: { type: "string", nullable: true },
            publisher: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        GameInput: {
          type: "object",
          required: ["title", "slug"],
          properties: {
            title: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            releaseDate: { type: "string", format: "date-time" },
            developer: { type: "string" },
            publisher: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./dist/routes/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
