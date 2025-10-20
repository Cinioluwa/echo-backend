# Echo Backend API

This is the official backend server for the Echo application, a social feedback platform for university students.

## Features Implemented
- User Authentication (Register, Login, JWT)
- Full CRUD for Pings, Waves (solutions), Comments, and Surges
- Role-Based Access Control (User, Representative, Admin)
- Admin-only endpoints for moderation and analytics
- Secure API with validation, rate limiting, CORS, and Helmet

## Tech Stack
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Local Development:** Docker

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Cinioluwa/echo-backend.git
    cd echo-backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root directory and copy the contents of `.env.example`. Fill in your actual database URL and a JWT secret.
    
    ```bash
    cp .env.example .env
    ```
    
    Then edit `.env` with your actual values:
    - `DATABASE_URL`: Your PostgreSQL connection string
    - `JWT_SECRET`: A secure random string for JWT signing

4.  **Start the local database:**
    Make sure Docker Desktop is running and execute:
    ```bash
    docker-compose up -d
    ```

5.  **Run database migrations:**
    ```bash
    npx prisma migrate dev
    ```

6.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The server will be available at `http://localhost:3000`.

## Available Scripts

- `npm run dev` - Start the development server with hot reload
- `npm run build` - Build the TypeScript project for production
- `npm start` - Start the production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations

## Project Structure

```
echo-backend/
├── src/
│   ├── server.ts              # Application entry point
│   ├── config/                # Configuration files (DB, logger)
│   ├── controllers/           # Request handlers
│   ├── middleware/            # Authentication, validation, error handling
│   ├── routes/                # API route definitions
│   ├── schemas/               # Zod validation schemas
│   └── types/                 # TypeScript type definitions
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migration history
├── .env                       # Environment variables (not in git)
├── .env.example               # Environment variables template
├── docker-compose.yml         # Local database setup
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## API Endpoints

### Authentication
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login and receive JWT token

### Pings (Issues/Complaints)
- `GET /api/pings` - Get all pings
- `POST /api/pings` - Create a new ping
- `GET /api/pings/:id` - Get a specific ping
- `PUT /api/pings/:id` - Update a ping
- `DELETE /api/pings/:id` - Delete a ping

### Waves (Solutions)
- `GET /api/waves` - Get all waves
- `POST /api/waves` - Create a new wave
- `GET /api/waves/:id` - Get a specific wave
- `PUT /api/waves/:id` - Update a wave
- `DELETE /api/waves/:id` - Delete a wave

### Comments
- `POST /api/comments` - Add a comment
- `PUT /api/comments/:id` - Update a comment
- `DELETE /api/comments/:id` - Delete a comment

### Surges (Upvotes)
- `POST /api/surges` - Toggle a surge on a ping or wave

### Admin Routes
- `GET /api/admin/users` - Get all users
- `GET /api/admin/analytics` - Get platform analytics
- `DELETE /api/admin/pings/:id` - Delete any ping
- `DELETE /api/admin/waves/:id` - Delete any wave

## Security Features

- **JWT Authentication:** Secure token-based authentication
- **Password Hashing:** Using bcrypt for secure password storage
- **Rate Limiting:** Prevents abuse and DDoS attacks
- **CORS:** Configured for secure cross-origin requests
- **Helmet:** Security headers for Express
- **Input Validation:** Zod schemas for request validation
- **Role-Based Access:** User, Representative, and Admin roles

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret key for JWT signing | `your_super_secret_key` |

## Deployment

This backend is designed to be deployed on modern cloud platforms:

- **Recommended:** Railway, Render, or AWS
- **Database:** Neon, Supabase, or managed PostgreSQL
- Ensure all environment variables are set in your deployment platform
- Run migrations before starting: `npx prisma migrate deploy`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Contact

For questions or support, please contact the development team.

---

Built with ❤️ for university students
