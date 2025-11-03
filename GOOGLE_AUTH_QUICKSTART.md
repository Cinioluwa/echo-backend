# Quick Start: Testing Google Auth in Postman

## Step 1: Get Your Google ID Token

### Using Google OAuth Playground (Easiest)

1. **Go to**: https://developers.google.com/oauthplayground/

2. **Configure OAuth** (Settings icon ⚙️):
   - Check "Use your own OAuth credentials"
   - Enter your Google Client ID
   - Enter your Google Client Secret

3. **Select Scopes** (left panel):
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `openid`

4. **Authorize**:
   - Click "Authorize APIs"
   - Sign in with your **company email** (not gmail.com)

5. **Get Token**:
   - Click "Exchange authorization code for tokens"
   - Copy the **`id_token`** (the long JWT string)

---

## Step 2: Test in Postman

### Request Setup

```
Method: POST
URL: http://127.0.0.1:3000/api/auth/google
```

### Headers
```
Content-Type: application/json
```

### Body (raw JSON)
```json
{
  "token": "PASTE_YOUR_ID_TOKEN_HERE"
}
```

### Send Request ✅

---

## Step 3: Expected Response

### Success (200)
```json
{
  "message": "Google authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "john@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "organizationId": 1,
    "profilePicture": "https://lh3.googleusercontent.com/..."
  }
}
```

### Save Token for Future Requests
In Postman **Tests** tab:
```javascript
pm.test("Save token", function() {
    var jsonData = pm.response.json();
    pm.environment.set("token", jsonData.token);
});
```

---

## Step 4: Use JWT Token

Now use the returned JWT token in other API requests:

```
GET http://127.0.0.1:3000/api/users/me
Authorization: Bearer {{token}}
```

---

## Common Errors

### ❌ "Invalid Google token"
- **Fix**: Token expired (valid ~1 hour). Get a new one.

### ❌ "Please use your company email address"
- **Fix**: Don't use gmail.com, yahoo.com, etc. Use your company domain.

### ❌ "No organization found for domain"
- **Fix**: Your organization must exist in the database first.
  ```sql
  INSERT INTO "Organization" (name, domain, status)
  VALUES ('My Company', 'company.com', 'ACTIVE');
  ```

### ❌ "GOOGLE_CLIENT_ID is required"
- **Fix**: Add to `.env`:
  ```env
  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
  ```

---

## That's It! 🎉

You now have:
- ✅ Google OAuth working
- ✅ JWT token for API access
- ✅ User auto-created/logged-in

For detailed docs, see: **GOOGLE_AUTH_TESTING_GUIDE.md**
