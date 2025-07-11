# Tiktok Clone Backend (Node.js + Express, MVC)

## Project Structure

```
Tiktok-Clone-Backend/
  controllers/      # Controller files
  models/           # Data models
  routes/           # Express route definitions
  app.js            # Main application entry point
  package.json      # NPM config
```

## HTTP Status Codes:

200 OK: The request has succeeded. The client can retrieve the requested data in the response body.\
201 Created:The request has been fulfilled, and a new resource has been created.\
400 Bad Request: Used for missing fields or invalid input.\
401 Unauthorized: Used for invalid credentials (e.g., incorrect password or OTP).\
403 Forbidden: Used when a user tries to log in without verification.\
404 Not Found: Used when the requested resource (user) does not exist.\
409 Conflict: Used when trying to register a user that already exists.\
500 Internal Server Error: Used for unexpected errors during database operations or other server-side issues.
