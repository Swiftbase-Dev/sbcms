# SBCMS - Swiftbase Content Management System

SBCMS is a modern, fast, and feature-rich Headless Content Management System designed to build and host high-performance websites. It provides intuitive page building, structured blogging, an online store module with Stripe checkout, paginated gallery management, and real-time moderation of comments.

SBCMS serves as a premier showcase application demonstrating how to build powerful multi-tenant web systems on top of the **Swiftbase** cloud hosting infrastructure.

---

## Architecture & Tech Stack

SBCMS is structured as a TypeScript monorepo using npm workspaces:

- **`frontend/`**: The admin control portal built with **Vue 3**, **Vite**, **Tailwind CSS**, **DaisyUI**, and **QuillJS** (configured with inline image resizing, alignment tools, and paginated asset search).
- **`backend/`**: A fast, asynchronous HTTP server built with **Fastify** and **TypeScript**. It registers API endpoints, manages content compilation, performs anti-spam comment moderation, and synchronizes items with Stripe.
- **`shared/`**: Common TypeScript types and interfaces sharing schema models between the frontend editor and backend API controllers.

---

## How SBCMS Leverages Swiftbase

SBCMS utilizes core Swiftbase cloud services to run database, storage, and publishing operations:

1. **Swiftbase Admin SDK**: Orchestrates admin service logins, database connections, and bucket storage commands.
2. **Swiftbase Database (SQL)**: Manages metadata models (`cms_settings`, `cms_pages`, `cms_posts`, `cms_comments`, `cms_products`) using standard relational schemas.
3. **Swiftbase Object Storage**:
   - Stores media uploads inside a dedicated assets bucket.
   - Automatically processes and serves compact `256px` thumbnails next to original files using Jimp image scaling.
4. **Static Site Rebuilding**: Whenever page updates or new articles are published, the backend compiles them into static html/css files and writes them directly back to the public Swiftbase Storage bucket, ensuring instant pageloads.

---

## Local Development Setup

Follow these steps to clone and run the project locally on your machine:

### Prerequisites
- Node.js (v20 or higher)
- npm (v9 or higher)

### 1. Clone the Repository
Clone the workspace repository (SBCMS is located under the `cms` subdirectory):
```bash
git clone https://github.com/your-org/swiftbase.git
cd swiftbase/cms
```

### 2. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Open `.env` and fill in your Stripe API credentials and Swiftbase Database configuration details:
```env
PORT=3000
SWIFTBASE_DATABASE_NAME=cms
SWIFTBASE_STORAGE_BUCKET=cms-site-assets
STRIPE_SECRET_KEY=sk_test_...
```

### 3. Install Dependencies & Build
Install all workspace dependencies and run initial package compilation:
```bash
npm install
npm run build
```

### 4. Start the Application
Start the Fastify backend and the Vite frontend simultaneously in development mode:
```bash
npm run dev
```
Open your browser and navigate to:
- **Admin Control Portal**: [http://localhost:5173/admin](http://localhost:5173/admin)
- **Local API Host**: [http://localhost:3000](http://localhost:3000)

---

## Build & Deploy to Swiftbase

SBCMS is designed to be containerized and run as a Swiftbase hosted app.

### 1. Build the Docker Image
To compile the multi-stage Docker build, run the build command from inside the `cms/` subdirectory:
```bash
docker buildx build --platform linux/arm64,linux/amd64 -t sbcms . --load
```

### 2. Run Container Locally
You can run your compiled container locally to verify settings:
```bash
docker run -p 3000:3000 \
  --env-file cms/.env \
  sbcms
```

### 3. Deploy to Swiftbase Control Plane
Deploy the image configuration details to your active Swiftbase cluster. Once deployed, route incoming traffic to port `3000`. The static files compiled during publishing will automatically serve under the configured Swiftbase Storage bucket domains.
