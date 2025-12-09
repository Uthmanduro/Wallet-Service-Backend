# Wallet Service API: Secure Digital Transactions with Paystack, JWT, & API Keys 💸

## Overview

This project is a robust backend service developed with Node.js and TypeScript, leveraging the Express.js framework to manage user wallets, transactions, and API key access. It integrates with PostgreSQL for data persistence, Paystack for payment processing, and Google OAuth for streamlined user authentication, providing a secure and scalable foundation for digital financial operations.

## Features

- **User Authentication**: Secure user login via Google OAuth and JWTs.
- **Wallet Management**: Each user is automatically assigned a unique digital wallet.
- **API Key Management**: Generate, manage, and rollover API keys with granular permissions and expiry.
- **Payment Processing**: Seamless deposits facilitated by Paystack integration.
- **Inter-Wallet Transfers**: Securely transfer funds between user wallets within the service.
- **Transaction History**: View detailed records of all deposits and transfers.
- **Data Persistence**: Utilizes PostgreSQL for reliable and structured data storage.
- **Type Safety**: Built with TypeScript for enhanced code quality and maintainability.
- **Asynchronous Error Handling**: Robust error management with `express-async-errors`.

## Getting Started

To get this project up and running locally, follow these steps.

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)
- npm (Node Package Manager)
- PostgreSQL
- Git

### Installation

1.  ⬇️ **Clone the Repository**:
    ```bash
    git clone https://github.com/Uthmanduro/Wallet-Service-Backend.git
    cd Wallet-Service-Backend
    ```
2.  📦 **Install Dependencies**:
    ```bash
    npm install
    ```
3.  ⚙️ **Set up PostgreSQL**:

    - Ensure your PostgreSQL server is running.
    - Create a database for the service, e.g., `wallet_service`.
    - The application will automatically create necessary tables on startup if they don't exist.

4.  🛠️ **Build the Project**:

    ```bash
    npm run build
    ```

5.  🚀 **Start the Development Server**:
    ```bash
    npm run dev
    ```
    Or, to run the compiled production build:
    ```bash
    npm start
    ```

### Environment Variables

Create a `.env` file in the root directory of the project and populate it with the following variables:

```dotenv
PORT=3000
JWT_SECRET=your-secure-jwt-secret-here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
DATABASE_URL=postgres://user:password@host:port/wallet_service
# Alternatively, you can use individual DB parameters if DATABASE_URL is not set:
# DB_USER=your_db_user
# DB_PASSWORD=your_db_password
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=wallet_service
```

## Usage

The Wallet Service API can be interacted with using a REST client (like Postman, Insomnia, or cURL) or integrated into your client-side applications.

### Authentication Flow

1.  **Google OAuth**: Initiate the Google OAuth flow by redirecting your user to `/auth/google`.
2.  **Callback**: After successful authentication with Google, Google redirects to the `GOOGLE_REDIRECT_URI` (e.g., `http://localhost:3000/auth/google/callback`).
3.  **JWT Token**: The `/auth/google/callback` endpoint will return a JWT token in the response body. This token should be used in the `Authorization` header for subsequent requests in the format `Bearer <YOUR_JWT_TOKEN>`.
4.  **API Keys**: Alternatively, after authenticating with a JWT, you can create API keys via the `/keys/create` endpoint. These keys can then be used by sending them in the `X-API-Key` header for requests, which provides a more programmatic way to interact with the API with specific permissions.

## API Documentation

### Base URL

`http://localhost:3000`

### Authentication

Endpoints requiring authentication can be accessed either with a **JWT Bearer Token** or an **API Key**.

- **JWT**: Include `Authorization: Bearer <token>` in the request header. JWT authenticated users have all permissions.
- **API Key**: Include `X-API-Key: <api_key>` in the request header. API key permissions are defined at creation.

### Endpoints

#### GET /auth/google

Initiates the Google OAuth login flow. Redirects the user to Google's authentication page.
**Request**:
(No direct request body or parameters, this is a redirect)

**Response**:
Redirects to Google. Upon successful authentication with Google, it redirects back to `/auth/google/callback`.

**Errors**:

- `400 Bad Request`: If authorization code is missing or invalid in the callback.
- `500 Internal Server Error`: If Google authentication fails.

#### GET /auth/google/callback

Handles the callback from Google OAuth after user authentication.
**Request**:
Query Parameters:

- `code`: Authorization code from Google.

**Response**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYjg2MjU0NmY2NzcxNmU3M2JkZmM3Njc2OTc2ZTI4MSIsImVtYWlsIjoiam9obmRvZUBleGFtcGxlLmNvbSIsImlhdCI6MTcwMjU0Nzg5MCwiZXhwIjoxNzAzMTUyNjkwfQ.ABCDEFGHIJ..."
}
```

**Errors**:

- `400 Bad Request`: If `code` query parameter is missing.
- `500 Internal Server Error`: If token exchange or user info retrieval fails.

#### POST /keys/create

**Authentication Required (JWT)**: Create a new API key for the authenticated user.
**Request**:

```json
{
  "name": "My New API Key",
  "permissions": ["deposit", "transfer", "read"],
  "expiry": "1M"
}
```

**Request Fields**:

- `name` (string, required): A descriptive name for the API key.
- `permissions` (string[], required): An array of permissions. Valid values: `["deposit", "transfer", "read"]`.
- `expiry` (string, required): The duration until the API key expires. Valid values: `"1H"`, `"1D"`, `"1M"`, `"1Y"`.

**Errors**:

- `400 Bad Request`: If `name`, `permissions`, or `expiry` are missing or invalid (e.g., unknown permission, invalid expiry format, or maximum active keys reached).
- `401 Unauthorized`: If no authentication token is provided or it's invalid.

#### POST /keys/rollover

**Authentication Required (JWT)**: Rollover an expired API key by generating a new one with the same permissions.
**Request**:

```json
{
  "expired_key_id": "api_key_id_of_an_expired_key",
  "expiry": "1D"
}
```

**Request Fields**:

- `expired_key_id` (string, required): The ID of the API key that needs to be rolled over.
- `expiry` (string, required): The new duration until the new API key expires. Valid values: `"1H"`, `"1D"`, `"1M"`, `"1Y"`.

**Response**:

```json
{
  "api_key": "sk_live_new_api_key_hash...",
  "expires_at": "2024-01-14T12:00:00.000Z"
}
```

**Errors**:

- `400 Bad Request`: If `expired_key_id` or `expiry` are missing, `expiry` is invalid, the specified key is not expired, or maximum active keys reached.
- `401 Unauthorized`: If no authentication token is provided or it's invalid.
- `404 Not Found`: If the `expired_key_id` does not exist for the authenticated user.

#### POST /wallet/deposit

**Authentication Required (JWT or API Key with `deposit` permission)**: Initiates a deposit transaction via Paystack.
**Request**:

```json
{
  "amount": 5000.0
}
```

**Request Fields**:

- `amount` (number, required): The amount to deposit (e.g., 5000.00).

**Response**:

```json
{
  "reference": "dep_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
  "authorization_url": "https://checkout.paystack.com/..."
}
```

**Errors**:

- `400 Bad Request`: If `amount` is missing, less than or equal to zero, or wallet not found for the user.
- `401 Unauthorized`: If no authentication token/API key is provided or it's invalid.
- `403 Forbidden`: If API key lacks `deposit` permission.
- `500 Internal Server Error`: If Paystack initialization fails.

#### POST /wallet/paystack/webhook

**No Authentication**: Endpoint for Paystack to send transaction status updates.
**Request**:
(Paystack webhook payload, varies by event type)
Headers:

- `x-paystack-signature`: HMAC SHA512 hash of the request body, signed with your Paystack secret key.

**Response**:

```json
{
  "status": true
}
```

(Paystack expects a 200-series response to acknowledge receipt)

**Errors**:

- `400 Bad Request`: If `x-paystack-signature` header is missing or invalid.
- Internal errors are logged but a `200 OK` with `{"status": true}` is always returned to Paystack to prevent retries.

#### GET /wallet/deposit/:reference/status

**No Authentication** (as per current code, typically would be authenticated): Retrieves the status of a specific deposit transaction.
**Request**:
(No direct request body)

**Response**:

```json
{
  "reference": "dep_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
  "status": "pending",
  "amount": 5000
}
```

**Errors**:

- `404 Not Found`: If the transaction reference does not exist.

#### GET /wallet/balance

**Authentication Required (JWT or API Key with `read` permission)**: Retrieves the current balance of the authenticated user's wallet.
**Request**:
(No request body)

**Response**:

```json
{
  "balance": 15000.5
}
```

**Errors**:

- `400 Bad Request`: If wallet not found for the user.
- `401 Unauthorized`: If no authentication token/API key is provided or it's invalid.
- `403 Forbidden`: If API key lacks `read` permission.

#### POST /wallet/transfer

**Authentication Required (JWT or API Key with `transfer` permission)**: Initiates a fund transfer from the authenticated user's wallet to another wallet.
**Request**:

```json
{
  "wallet_number": "1234567890123",
  "amount": 1000.0
}
```

**Request Fields**:

- `wallet_number` (string, required): The wallet number of the recipient.
- `amount` (number, required): The amount to transfer (e.g., 1000.00).

**Response**:

```json
{
  "status": "success",
  "message": "Transfer completed"
}
```

**Errors**:

- `400 Bad Request`: If `wallet_number` or `amount` are missing, `amount` is invalid, insufficient balance, or attempting to transfer to own wallet.
- `401 Unauthorized`: If no authentication token/API key is provided or it's invalid.
- `403 Forbidden`: If API key lacks `transfer` permission.
- `404 Not Found`: If recipient `wallet_number` does not exist.
- `500 Internal Server Error`: If the database transaction for transfer fails.

#### GET /wallet/transactions

**Authentication Required (JWT or API Key with `read` permission)**: Retrieves the transaction history for the authenticated user's wallet.
**Request**:
(No request body)

**Response**:

```json
[
  {
    "type": "deposit",
    "amount": 5000,
    "status": "success"
  },
  {
    "type": "transfer",
    "amount": -1000,
    "status": "success"
  },
  {
    "type": "transfer",
    "amount": 2500,
    "status": "success"
  }
]
```

**Errors**:

- `400 Bad Request`: If wallet not found for the user.
- `401 Unauthorized`: If no authentication token/API key is provided or it's invalid.
- `403 Forbidden`: If API key lacks `read` permission.

## Technologies Used

| Technology                                     | Description                                                |
| :--------------------------------------------- | :--------------------------------------------------------- |
| [Node.js](https://nodejs.org/en/)              | JavaScript runtime for server-side execution.              |
| [Express.js](https://expressjs.com/)           | Fast, unopinionated, minimalist web framework for Node.js. |
| [TypeScript](https://www.typescriptlang.org/)  | Superset of JavaScript that adds static typing.            |
| [PostgreSQL](https://www.postgresql.org/)      | Powerful, open-source object-relational database system.   |
| [JWT](https://jwt.io/)                         | JSON Web Tokens for secure authentication.                 |
| [Axios](https://axios-http.com/)               | Promise-based HTTP client for the browser and Node.js.     |
| [Dotenv](https://www.npmjs.com/package/dotenv) | Loads environment variables from a `.env` file.            |
| [Paystack](https://paystack.com/)              | Payment gateway for online transactions.                   |

## Contributing

We welcome contributions to this project! If you're looking to help, please consider the following:

- 🐛 **Find a bug?** Open an issue to report it.
- ✨ **Have a feature idea?** Open an issue to discuss it.
- 👨‍💻 **Want to contribute code?**
  1.  Fork the repository.
  2.  Create a new branch (`git checkout -b feature/your-feature-name`).
  3.  Make your changes and ensure tests pass.
  4.  Commit your changes (`git commit -m 'feat: Add new feature'`).
  5.  Push to your branch (`git push origin feature/your-feature-name`).
  6.  Open a Pull Request.

Please ensure your code adheres to the project's coding style and includes appropriate tests.

## License

This project is licensed under the MIT License.

## Author Info

- **Name**: Uthman Durosinlohun
- **LinkedIn**: [Connect with me](https://linkedin.com/in/uthmanduro)
- **Twitter/X**: [Follow me](https://x.com/lekan_duro)

---

![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

[![Readme was generated by Dokugen](https://img.shields.io/badge/Readme%20was%20generated%20by-Dokugen-brightgreen)](https://www.npmjs.com/package/dokugen)
