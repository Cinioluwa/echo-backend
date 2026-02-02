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
        email: 'covenant@echo-ng.com',
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
            level: {
              type: 'integer',
              nullable: true,
              description: 'User level (e.g., student year)',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
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
            organizationId: {
              type: 'integer',
              description: 'Organization this category belongs to',
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
              enum: ['PENDING', 'APPROVED', 'DECLINED', 'POSTED'],
              description: 'Ping moderation status',
            },
            progressStatus: {
              type: 'string',
              enum: ['NONE', 'UNACKNOWLEDGED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'],
              description: 'Progress status for issue resolution',
            },
            surgeCount: {
              type: 'integer',
              description: 'Number of surges (likes)',
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
            officialResponse: {
              allOf: [
                { $ref: '#/components/schemas/OfficialResponse' },
                {
                  nullable: true,
                  description: 'Official response if any',
                },
              ],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            acknowledgedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the ping was acknowledged',
            },
            resolvedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the ping was resolved',
            },
            _count: {
              type: 'object',
              properties: {
                waves: { type: 'integer', description: 'Number of waves' },
                comments: { type: 'integer', description: 'Number of comments' },
                surges: { type: 'integer', description: 'Number of surges' },
              },
            },
          },
        },
        Wave: {
          type: 'object',
          description: 'A solution or response to a ping',
          properties: {
            id: {
              type: 'integer',
              description: 'Wave ID',
            },
            solution: {
              type: 'string',
              description: 'The proposed solution text',
            },
            pingId: {
              type: 'integer',
              description: 'ID of the parent ping',
            },
            ping: {
              $ref: '#/components/schemas/Ping',
            },
            isAnonymous: {
              type: 'boolean',
              description: 'Whether the wave is anonymous',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'DECLINED', 'POSTED'],
              description: 'Wave moderation status',
            },
            surgeCount: {
              type: 'integer',
              description: 'Number of surges (likes)',
            },
            viewCount: {
              type: 'integer',
              description: 'Number of views',
            },
            flaggedForReview: {
              type: 'boolean',
              description: 'Whether flagged for representative review',
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
                comments: { type: 'integer', description: 'Number of comments' },
                surges: { type: 'integer', description: 'Number of surges' },
              },
            },
          },
        },
        Comment: {
          type: 'object',
          description: 'A comment on a ping or wave',
          properties: {
            id: {
              type: 'integer',
              description: 'Comment ID',
            },
            content: {
              type: 'string',
              description: 'Comment text',
            },
            pingId: {
              type: 'integer',
              nullable: true,
              description: 'ID of the parent ping (if comment is on a ping)',
            },
            waveId: {
              type: 'integer',
              nullable: true,
              description: 'ID of the parent wave (if comment is on a wave)',
            },
            isAnonymous: {
              type: 'boolean',
              description: 'Whether the comment is anonymous',
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
          },
        },
        Surge: {
          type: 'object',
          description: 'A like/upvote on a ping or wave',
          properties: {
            id: {
              type: 'integer',
              description: 'Surge ID',
            },
            userId: {
              type: 'integer',
              description: 'ID of the user who surged',
            },
            pingId: {
              type: 'integer',
              nullable: true,
              description: 'ID of the surged ping',
            },
            waveId: {
              type: 'integer',
              nullable: true,
              description: 'ID of the surged wave',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'When the surge was created',
            },
          },
        },
        Announcement: {
          type: 'object',
          description: 'An organization-wide announcement',
          properties: {
            id: {
              type: 'integer',
              description: 'Announcement ID',
            },
            title: {
              type: 'string',
              description: 'Announcement title',
            },
            content: {
              type: 'string',
              description: 'Announcement content',
            },
            categoryId: {
              type: 'integer',
              nullable: true,
              description: 'Target category (optional)',
            },
            targetLevels: {
              type: 'array',
              items: {
                type: 'integer',
              },
              description: 'Target user levels (optional)',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the announcement expires',
            },
            author: {
              $ref: '#/components/schemas/User',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
        },
        OfficialResponse: {
          type: 'object',
          description: 'An official response from a representative/admin',
          properties: {
            id: {
              type: 'integer',
              description: 'Official response ID',
            },
            content: {
              type: 'string',
              description: 'Response content',
            },
            pingId: {
              type: 'integer',
              description: 'ID of the ping this responds to',
            },
            author: {
              $ref: '#/components/schemas/User',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Notification: {
          type: 'object',
          description: 'A user notification',
          properties: {
            id: {
              type: 'integer',
              description: 'Notification ID',
            },
            type: {
              type: 'string',
              enum: ['COMMENT', 'SURGE', 'OFFICIAL_RESPONSE', 'ANNOUNCEMENT', 'WAVE', 'PING_STATUS'],
              description: 'Type of notification',
            },
            message: {
              type: 'string',
              description: 'Notification message',
            },
            read: {
              type: 'boolean',
              description: 'Whether the notification has been read',
            },
            pingId: {
              type: 'integer',
              nullable: true,
              description: 'Related ping ID',
            },
            waveId: {
              type: 'integer',
              nullable: true,
              description: 'Related wave ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
        },
        Media: {
          type: 'object',
          description: 'An uploaded media file',
          properties: {
            id: {
              type: 'integer',
              description: 'Media ID',
            },
            url: {
              type: 'string',
              description: 'Public URL of the file',
            },
            filename: {
              type: 'string',
              description: 'Original filename',
            },
            mimeType: {
              type: 'string',
              description: 'MIME type of the file',
            },
            size: {
              type: 'integer',
              description: 'File size in bytes',
            },
            pingId: {
              type: 'integer',
              nullable: true,
              description: 'Attached ping ID',
            },
            waveId: {
              type: 'integer',
              nullable: true,
              description: 'Attached wave ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp',
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
        name: 'Users',
        description: 'User registration, login, and profile management',
      },
      {
        name: 'Pings',
        description: 'Ping (issue) management - create, read, update, delete issues',
      },
      {
        name: 'Waves',
        description: 'Wave (solution) management - propose and manage solutions',
      },
      {
        name: 'Comments',
        description: 'Comments on pings and waves',
      },
      {
        name: 'Surges',
        description: 'Like/upvote functionality for pings and waves',
      },
      {
        name: 'Categories',
        description: 'Category management for organizing content',
      },
      {
        name: 'Notifications',
        description: 'User notification management',
      },
      {
        name: 'Announcements',
        description: 'Organization-wide announcements',
      },
      {
        name: 'Official Responses',
        description: 'Official responses from representatives/admins',
      },
      {
        name: 'Representative',
        description: 'Representative-only endpoints for review and escalation',
      },
      {
        name: 'Public',
        description: 'Public-facing endpoints (soundboard, stream, resolution log)',
      },
      {
        name: 'Admin',
        description: 'Admin-only endpoints for moderation and analytics',
      },
      {
        name: 'Uploads',
        description: 'File upload and media management',
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
