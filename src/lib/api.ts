import axios from 'axios'

// Create a pre-configured axios instance that always talks to your backend.
// Now every component just calls `api.post('/upload', ...)` instead of
// repeating the full URL everywhere.
export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})
