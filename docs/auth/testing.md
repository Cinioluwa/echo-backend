# Google Auth Testing Guide

## Overview
This guide explains how to test the Google OAuth authentication endpoint in your Echo backend API.

## Prerequisites
1. **Google Cloud Console Setup**
   - Create a project at https://console.cloud.google.com/
   - Enable Google+ API
   - Create OAuth 2.0 credentials (Web application)
  - Add authorized redirect URIs (e.g., `http://localhost:3000`)
  - If your frontend runs on Vite, also add Authorized JavaScript origin: `http://localhost:5173`

2. **Environment Configuration**
   Add to your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

3. **Active Organization**
   - Ensure you have an active organization in your database
   - The organization's domain must match your Google account's email domain
   - Example: If using `john@acmecorp.com`, organization domain should be `acmecorp.com`

---

## Method 1: Using Google OAuth Playground (Recommended for Backend Testing)

### Step 1: Configure OAuth Playground
1. Visit https://developers.google.com/oauthplayground/
2. Click the settings icon (⚙️) in the top right
3. Check **"Use your own OAuth credentials"**
4. Enter:
   - **OAuth Client ID**: Your `GOOGLE_CLIENT_ID`
   - **OAuth Client secret**: Your client secret (from Google Console)

### Step 2: Get ID Token
1. In the left panel, select scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `openid`
2. Click **"Authorize APIs"**
3. Sign in with your company Google account (not gmail.com)
4. Click **"Exchange authorization code for tokens"**
5. Copy the **`id_token`** value (long JWT string)

### Step 3: Test in Postman
1. Create a new POST request:
   ```
   POST http://127.0.0.1:3000/api/auth/google
   ```

2. Set headers:
   ```
   Content-Type: application/json
   ```

3. Body (raw JSON):
   ```json
   {
     "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjY4ZGE...your-id-token-here"
   }
   ```

4. Send the request

### Expected Response (Success - New User):
```json
{
  "message": "Google authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 123,
    "email": "john@acmecorp.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "organizationId": 1,
    "profilePicture": "https://lh3.googleusercontent.com/..."
  }
}
```

### Expected Response (Success - Existing User):
Same as above, but user is logged in instead of created.

---

## Method 2: Using Frontend Test Page

### Step 1: Create Test HTML File
Save this as `test-google-auth.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Google Auth Test</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <h1>Test Google OAuth</h1>
  
  <!-- Google Sign-In Button -->
  <div id="g_id_onload"
       data-client_id="YOUR_GOOGLE_CLIENT_ID_HERE"
       data-callback="handleCredentialResponse">
  </div>
  <div class="g_id_signin" data-type="standard"></div>
  
  <div id="result"></div>

  <script>
    async function handleCredentialResponse(response) {
      const idToken = response.credential;
      console.log('ID Token:', idToken);
      
      try {
        const res = await fetch('http://127.0.0.1:3000/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: idToken })
        });
        
        const data = await res.json();
        document.getElementById('result').innerHTML = 
          `<pre>${JSON.stringify(data, null, 2)}</pre>`;
      } catch (error) {
        document.getElementById('result').innerHTML = 
          `<pre>Error: ${error.message}</pre>`;
      }
    }
  </script>
</body>
</html>
```

### Step 2: Test
1. Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with your actual client ID
2. Open the HTML file in a browser
3. Click "Sign in with Google"
4. Check the result displayed on the page

---

## Method 3: Using Postman's Built-in OAuth 2.0

### Step 1: Configure Postman
1. Create a new request in Postman
2. Go to the **Authorization** tab
3. Select **OAuth 2.0** as Type
4. Configure:
   - **Grant Type**: Authorization Code
   - **Auth URL**: `https://accounts.google.com/o/oauth2/v2/auth`
   - **Access Token URL**: `https://oauth2.googleapis.com/token`
   - **Client ID**: Your Google Client ID
   - **Client Secret**: Your Google Client Secret
   - **Scope**: `openid email profile`
   - **Callback URL**: `https://oauth.pstmn.io/v1/callback` (or your configured redirect URI)

### Step 2: Get Token
1. Click **"Get New Access Token"**
2. Sign in with Google
3. Postman will receive the token
4. Click **"Use Token"**

### Step 3: Extract ID Token
Unfortunately, Postman's OAuth flow gives you an access token, not an ID token. For backend verification, you need the ID token. Use Method 1 or 2 instead.

---

## Error Scenarios to Test

### 1. Invalid Token
```bash
# Request
POST /api/auth/google
{
  "token": "invalid-token"
}

# Response (401)
{
  "error": "Invalid Google token"
}
```

### 2. Consumer Email Domain (Gmail, Yahoo, etc.)
```bash
# Request with gmail.com account
POST /api/auth/google
{
  "token": "valid-token-but-gmail-account"
}

# Response (400)
{
  "error": "Please use your company email address. Consumer email domains are not allowed."
}
```

### 3. No Organization for Domain
```bash
# Request with email domain not in database
POST /api/auth/google
{
  "token": "valid-token-unknown-domain"
}

# Response (404)
{
  "error": "No organization found for domain: unknown.com. Please contact your administrator."
}
```

### 4. Inactive Organization
```bash
# Request with email from inactive organization
POST /api/auth/google
{
  "token": "valid-token-inactive-org"
}

# Response (403)
{
  "error": "Your organization is not active. Please contact support."
}
```

### 5. Missing Token
```bash
# Request
POST /api/auth/google
{
}

# Response (400)
{
  "error": "Validation failed",
  "details": [
    {
      "field": "body.token",
      "message": "Google token is required"
    }
  ]
}
```

---

## Using the JWT Token

After successful authentication, use the returned JWT token in subsequent requests:

```bash
GET http://127.0.0.1:3000/api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Postman Collection Setup

Add this to your existing Postman collection:

1. **Save Token to Environment**
   - In the Google Auth request, go to **Tests** tab
   - Add this script:
   ```javascript
   if (pm.response.code === 200) {
       const jsonData = pm.response.json();
       pm.environment.set("token", jsonData.token);
       pm.environment.set("user_id", jsonData.user.id);
       console.log("Token saved:", jsonData.token);
   }
   ```

2. **Use Token in Other Requests**
   - In any protected endpoint
   - Authorization tab → Select **Bearer Token**
   - Token value: `{{token}}`

---

## Troubleshooting

### Issue: "Invalid Google token"
- **Cause**: Token expired (tokens are valid for ~1 hour)
- **Solution**: Get a new token from OAuth Playground

### Issue: "Email not verified by Google"
- **Cause**: Google account email not verified
- **Solution**: Verify your Google account email first

### Issue: "GOOGLE_CLIENT_ID is required"
- **Cause**: Missing environment variable
- **Solution**: Add `GOOGLE_CLIENT_ID` to `.env` file and restart server

### Issue: Token works in OAuth Playground but not in your backend
- **Cause**: Client ID mismatch
- **Solution**: Ensure the token was generated for the same client ID configured in your backend

### Issue: "No organization found for domain"
- **Cause**: Organization not in database or domain doesn't match
- **Solution**: 
  1. Check database: `SELECT * FROM "Organization" WHERE domain = 'your-domain.com';`
  2. Create organization if missing
  3. Ensure email domain extraction is correct

---

## Testing Flow Diagram

```
1. User clicks "Sign in with Google" → Google Login Page
2. User authenticates → Google returns ID token to frontend
3. Frontend sends ID token to backend → POST /api/auth/google
4. Backend verifies token with Google → Validates user email
5. Backend checks organization by email domain → Finds/Creates user
6. Backend issues JWT token → Returns token + user data
7. Frontend stores JWT → Uses for subsequent API calls
```

---

## Security Notes

1. **Never expose tokens in logs** - Tokens are automatically redacted by the logger
2. **Use HTTPS in production** - Never send tokens over HTTP
3. **Short-lived tokens** - ID tokens expire after ~1 hour
4. **Backend verification** - Always verify tokens server-side, never trust client
5. **Rate limiting** - Auth endpoint limited to 5 requests per 15 minutes per IP

---

## Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/google` | POST | Authenticate with Google |
| Body: `{ "token": "..." }` | - | Google ID token |
| Returns: `{ token, user }` | - | Your app's JWT + user info |

**Rate Limit**: 5 requests per 15 minutes
**Token Expiry**: 1 hour (your JWT)
**Required Env**: `GOOGLE_CLIENT_ID`
