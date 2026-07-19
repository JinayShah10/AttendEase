# DJSCE Attendance Portal

A modern web application for managing student attendance at Dwarkadas J. Sanghvi College of Engineering.

## Features
- **Admin Dashboard:** View attendance reports, manage faculty, track student attendance
- **Faculty Upload:** Easy Excel-based attendance data submission
- **Dark Mode:** Full dark mode support with persistent preference
- **Real-time Alerts:** Automatic flagging of students below 75% attendance
- **Responsive Design:** Works on desktop, tablet, and mobile

## Architecture
- **Frontend:** React 19 + Vite with Tailwind CSS
- **UI Library:** Bootstrap 5 + Lucide icons
- **Animation:** Three.js 3D backgrounds
- **State Management:** React Context API (auth state + dark mode preference)
- **Database:** MongoDB with Mongoose — dynamic per-class collections (e.g. SY_D1_2025-26), seeded on startup via seed.js

## Project Structure
... (omitted for brevity in this replace call, will keep existing structure) ...

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas Account (Cluster must be created)

### Installation
1. Clone the repository
   ```bash
   git clone https://github.com/mahee0802/DJSCE-Attendance-Portal-Web-Mini-Project.git
   ```
2. Install dependencies
   ```bash
   npm install
   ```

3. Setup environment variables:
   - Create a `.env` file in the root directory (refer to `.env.example`).
   - `JWT_SECRET` must NOT be left as 'yoursecretkey' — the server will refuse to start if it is.
   - `MONGODB_URI` must be set to your MongoDB Atlas connection string.
   
4. MongoDB Atlas Setup:
   - Create a free cluster on MongoDB Atlas.
   - Under "Database Access", create a new database user and save the password.
   - Under "Network Access", whitelist your IP address (or `0.0.0.0/0` to allow all).
   - Click "Connect" -> "Connect your application" and copy the connection string.
   - Replace `<password>` in the connection string with your DB user password and paste it into `MONGODB_URI` in your `.env` file.

5. Start the backend server:
   ```bash
   npm run start
   ```
   *(The database is seeded automatically with subjects and classes on first run.)*

6. Start the frontend dev server:
   ```bash
   npm run dev
   ```

### Supabase Storage Setup
To configure file storage for Excel and PDF reports:
1. Create a project on the [Supabase Dashboard](https://supabase.com).
2. Navigate to **Storage** and create a new bucket named `reports`.
3. Set the bucket privacy:
   - For public file URLs, toggle the bucket to **Public**.
   - Otherwise, keep it private and configure appropriate policies.
4. Set up the following policies for the `reports` bucket under **Policies**:
   - **SELECT / READ**: Allow read access.
   - **INSERT / CREATE**: Allow upload access for authenticated/admin roles.
   - **DELETE**: Allow delete access for authenticated/admin roles.
5. Retrieve your project settings under **Project Settings** -> **API**:
   - Copy the Project URL and set it as `SUPABASE_URL`.
   - Copy the `anon` public key and set it as `SUPABASE_ANON_KEY`.
   - Copy the `service_role` secret key and set it as `SUPABASE_SERVICE_ROLE_KEY`.

### Upload & Download Workflows
- **Upload:** Excel sheets uploaded by Faculty via the attendance upload page are automatically stored inside the `reports/excel/` folder of the `reports` Supabase Storage bucket. PDF reports go into `reports/pdf/`.
- **Download:** The backend retrieves the requested file from the Supabase bucket via Node buffer streams and serves it directly to the frontend, ensuring compatibility with standard anchor downloads.
- **Delete:** When an upload is deleted by a faculty member, the file is automatically removed from the Supabase bucket and MongoDB records are cleaned up.

### Database Reset & Seeding
To completely clean the database and start from a fresh slate:
1. Run the database reset script:
   ```bash
   npm run reset
   ```
   *This purges all user-generated data (Admins, Faculty, Students, Attendance Records, Uploads, logs, and tokens) and cleans the Supabase Storage bucket.*
2. Reseed the master data:
   ```bash
   npm run seed --force
   ```
   *This recreates the master configuration collections (Classes, Subjects, and Open Electives) without adding any user-generated data.*

---
© 2026 Dwarkadas J. Sanghvi College of Engineering.
