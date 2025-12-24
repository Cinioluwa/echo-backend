# E2E Testing Suite

This directory contains End-to-End (E2E) tests that validate complete user workflows and critical business processes for the Echo Backend API.

## Test Coverage

### 1. User Onboarding (`user-onboarding.spec.ts`)
**Purpose**: Validates the complete user registration and initial interaction journey.

**Test Flow**:
- User registration with email verification simulation
- Account login and authentication
- Category creation for organization
- First ping creation with proper validation
- Surge functionality on own ping
- Comment creation and retrieval
- Profile verification with activity stats

**Key Validations**:
- ✅ Registration workflow completion
- ✅ Authentication token generation
- ✅ Data persistence across requests
- ✅ User-generated content creation
- ✅ Activity tracking and statistics

### 2. Ping Lifecycle (`ping-lifecycle.spec.ts`)
**Purpose**: Tests the complete ping journey from creation through community engagement to resolution.

**Test Flow**:
- Ping creation with urgent issue
- Community surge support (multiple users)
- Discussion thread with comments
- Admin progress status updates
- Official response creation
- Issue resolution workflow
- Post-resolution community feedback

**Key Validations**:
- ✅ Community engagement mechanics
- ✅ Admin intervention workflows
- ✅ Status progression tracking
- ✅ Official communication channels
- ✅ Complete issue resolution cycle

### 3. Admin Management (`admin-management.spec.ts`)
**Purpose**: Validates administrative oversight and platform management capabilities.

**Test Flow**:
- Platform statistics access and validation
- User management (view, promote/demote roles)
- Analytics data retrieval (by level and category)
- Organization-wide announcement creation
- Announcement lifecycle (create, update, delete)
- Cross-user announcement visibility

**Key Validations**:
- ✅ Administrative access controls
- ✅ User role management
- ✅ Platform analytics functionality
- ✅ Organization communication tools
- ✅ Admin action auditing

### 4. Cross-Organization Isolation (`cross-org-isolation.spec.ts`)
**Purpose**: Ensures complete data isolation between organizations for security and privacy.

**Test Flow**:
- Multi-organization setup verification
- Cross-org ping and category isolation
- Announcement visibility boundaries
- Admin operation scope limitations
- Comment and surge access controls

**Key Validations**:
- ✅ Data isolation enforcement
- ✅ Access control boundaries
- ✅ Multi-tenant security
- ✅ Cross-organization data leakage prevention

## Running E2E Tests

### Prerequisites
1. Backend server running on `http://localhost:3000` (or set `E2E_BASE_URL`)
2. Database populated with test organizations and users
3. Test data fixtures available

### Commands
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test user-onboarding.spec.ts

# Run with headed browser (for debugging)
npx playwright test --headed

# Run with detailed output
npx playwright test --reporter=line
```

### Test Data Requirements
The E2E tests expect the following test accounts to exist:
- **Organization 1** (`testorg1.edu`):
  - Admin: `admin@testorg1.edu` / `password123`
  - User: `user@testorg1.edu` / `password123`
- **Organization 2** (`testorg2.edu`):
  - User: `user@testorg2.edu` / `password123`

### Environment Variables
- `E2E_BASE_URL`: Base URL for the API (default: `http://localhost:3000`)

## Test Architecture

### API-Only Testing
These E2E tests focus on API endpoints rather than UI interactions, providing:
- Fast execution (no browser overhead)
- Reliable automation (no UI flakiness)
- Direct validation of business logic
- Complete backend workflow coverage

### Database Isolation
Each test suite manages its own test data to prevent interference:
- Unique identifiers for test resources
- Automatic cleanup where possible
- Isolated test execution
- No shared state between tests

### Authentication Handling
- JWT token management per test session
- Role-based access validation
- Multi-organization context switching
- Secure credential handling

## CI/CD Integration

These E2E tests are designed for automated testing pipelines:
- Self-contained execution
- Clear pass/fail criteria
- Comprehensive error reporting
- Performance benchmarking capabilities

## Troubleshooting

### Common Issues
1. **Server not running**: Ensure backend is started before E2E tests
2. **Database state**: Tests may fail if test data is missing or corrupted
3. **Network timeouts**: Increase timeout values for slower environments
4. **Authentication failures**: Verify test user credentials are correct

### Debug Mode
```bash
# Run with debug output
DEBUG=pw:api npx playwright test

# Run single test with detailed logging
npx playwright test user-onboarding.spec.ts --reporter=verbose
```