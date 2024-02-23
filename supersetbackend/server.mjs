import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const PORT = 3001;
const app = express();
const supersetURL = process.env.SUPERSET_URL || 'http://localhost:8088';

app.use(cors());

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function fetchCSRFToken(accessToken) {
  try {
    const response = await fetch(
      `${supersetURL}/api/v1/security/csrf_token`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token'); // Handle failed request
    }

    // Extract the CSRF token from the response JSON
    const jsonResponse = await response.json();
    const csrfToken = jsonResponse?.result;

    // Extract cookies from the response headers
    const cookies = response.headers.raw()['set-cookie'];
    const sessionCookie = cookies ? cookies.join('; ') : null;

    console.log("CSRF token:", csrfToken);
    console.log("Session cookie:", sessionCookie);

    return {
      csrfToken: csrfToken,
      sessionCookie: sessionCookie,
    };
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return {
      csrfToken: null,
      sessionCookie: null,
    };
  }
}

async function fetchAccessToken() {
  try {
    const body = {
      username: "admin",
      password: "admin",
      provider: "db",
      refresh: true,
    };

    const response = await fetch(
      `${supersetURL}/api/v1/security/login`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const jsonResponse = await response.json();
    return jsonResponse?.access_token;
  } catch (e) {
    console.error(e);
  }
}

async function fetchGuestToken() {
  const accessToken = await fetchAccessToken();
  const csrfTokenResponse = await fetchCSRFToken(accessToken);
  const csrfToken = csrfTokenResponse.csrfToken;
  const sessionCookie = csrfTokenResponse.sessionCookie;

  console.log("access token: ", accessToken);
  console.log("CSRF token: ", csrfToken);
  try {
    const body = {
      "resources": [
        {
          "id": "00d63041-09c9-460e-80c0-a2d2e916ca23",
          "type": "dashboard"
        }
      ],
      "rls": [],
      "user": {
        "first_name": "Superset",
        "last_name": "Admin",
        "username": "admin"
      }
    };
    console.log("body", body)
    const guest_token_header = {
      "accept": "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
      Authorization: `Bearer ${accessToken}`,
      'Cookie': `${sessionCookie}`
    }
    console.log(guest_token_header);
    const response = await fetch(
      `${supersetURL}/api/v1/security/guest_token`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "accept": "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
          Authorization: `Bearer ${accessToken}`,
          'Cookie': `${sessionCookie}`
        },
        redirect: "follow",
      }
    );
    console.log({ response });
    const jsonResponse = await response.json();
    console.log("token", jsonResponse.token);
    return jsonResponse?.token;
  } catch (error) {
    console.error(error);
  }
}

app.get("/guest-token", async (req, res) => {
  const token = await fetchGuestToken();
  console.log("token received :", token);
  res.json({ token });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});