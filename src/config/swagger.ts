// src/config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Echo Backend API',
      version: '1.0.0',
      description: `
Backend API for Echo — a social feedback platform for university students with multitenancy support.

## Features
- **Authentication**: JWT-based auth with Google OAuth support
- **Multitenancy**: Organization-scoped data isolation
- **Core Entities**: Pings (issues), Waves (solutions), Comments, Surges (likes), Official Responses
- **Roles**: USER, REPRESENTATIVE, ADMIN with protected routes
- **Security**: Validation (Zod), rate limiting, CORS, Helmet

## Authentication
Most endpoints require authentication via JWT token. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

Get a token by:
- Logging in: \`POST /api/users/login\`
- Registering: \`POST /api/users/register\` then verify email
- Google OAuth: \`POST /api/auth/google\`

## Multitenancy
All data is scoped to your organization (determined by email domain). Users can only access data within their organization.

## Rate Limiting
- Global: 500 requests / 15 minutes
- Auth endpoints: 5 attempts / 15 minutes
- Create/Update operations: 30 operations / 15 minutes
      `,
      contact: {
        name: 'Echo API Support',
        email: 'support@echo-ng.com',
      },
      license: {
        name: 'Private and Proprietary',
      },
    },
    servers: [
      {
        url: env.APP_URL || `http://localhost:${env.PORT}`,
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from login or registration',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Optional error code',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            firstName: {
              type: 'string',
              description: 'User first name',
            },
            lastName: {
              type: 'string',
              description: 'User last name',
            },
            role: {
              type: 'string',
              enum: ['USER', 'REPRESENTATIVE', 'ADMIN'],
              description: 'User role',
            },
            organizationId: {
              type: 'integer',
              description: 'Organization ID',
            },
            profilePicture: {
              type: 'string',
              nullable: true,
              description: 'Profile picture URL',
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Category ID',
            },
            name: {
              type: 'string',
              description: 'Category name',
            },
          },
        },
        Ping: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Ping ID',
            },
            title: {
              type: 'string',
              description: 'Ping title',
            },
            content: {
              type: 'string',
              description: 'Ping content',
            },
            categoryId: {
              type: 'integer',
              description: 'Category ID',
            },
            category: {
              $ref: '#/components/schemas/Category',
            },
            hashtag: {
              type: 'string',
              nullable: true,
              description: 'Optional hashtag',
            },
            isAnonymous: {
              type: 'boolean',
              description: 'Whether the ping is anonymous',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'DECLINED'],
              description: 'Ping status',
            },
            progressStatus: {
              type: 'string',
              enum: ['UNACKNOWLEDGED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'],
              description: 'Progress status',
            },
            author: {
              allOf: [
                { $ref: '#/components/schemas/User' },
                {
                  nullable: true,
                  description: 'Author (null if anonymous)',
                },
              ],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            _count: {
              type: 'object',
              properties: {
                waves: { type: 'integer' },
                comments: { type: 'integer' },
                surges: { type: 'integer' },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            totalItems: {
              type: 'integer',
              description: 'Total number of items',
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
            },
            currentPage: {
              type: 'integer',
              description: 'Current page number',
            },
            itemsPerPage: {
              type: 'integer',
              description: 'Number of items per page',
            },
            hasNextPage: {
              type: 'boolean',
              description: 'Whether there is a next page',
            },
            hasPreviousPage: {
              type: 'boolean',
              description: 'Whether there is a previous page',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Pings',
        description: 'Ping (issue) management',
      },
      {
        name: 'Waves',
        description: 'Wave (solution) management',
      },
      {
        name: 'Categories',
        description: 'Category management',
      },
      {
        name: 'Public',
        description: 'Public-facing endpoints (authentication required for organization context)',
      },
      {
        name: 'Admin',
        description: 'Admin-only endpoints',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  // Paths to files containing OpenAPI definitions (JSDoc comments)
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
