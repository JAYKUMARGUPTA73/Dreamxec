# Jira Tickets: Secure Sensitive Data Leakage & API Payload Bloat

This document contains pre-formatted Jira Epics and User Stories designed to track, schedule, and resolve the security vulnerabilities and payload bloat issues identified in the codebase. 

Each story is written in simple terms and contains the **exact files**, **original code snippets**, **JSON schema changes**, and **step-by-step developer instructions** to make implementation trivial for any developer.

---

## EPIC: DREAM-100 — Resolve Sensitive Data Leakage & API Payload Bloat
**Description:**  
Audit and secure all backend controllers to ensure they only expose data fields that are strictly necessary for the frontend components. This Epic addresses critical security vulnerabilities (hashed password exposure, system tokens leakage) and performance issues (bloated payloads on card lists and search views).

---

### TICKET: DREAM-101 — Secure User & Donor Profile Update Responses
*   **Issue Type:** Story (Security Vulnerability)
*   **Priority:** High
*   **Component:** Backend API / Profile
*   **User Story:**  
    *   **As a** registered user/donor,  
    *   **I want** my password hashes and security tokens to be excluded from API response bodies,  
    *   **So that** my credentials and password reset keys cannot be hijacked by malicious third-party scripts.
*   **Description:**  
    The backend profile update endpoints currently return the direct database output of `prisma.user.update` and `prisma.donor.upsert`. This leaks hashed passwords, password reset tokens, and email verification tokens in the response JSON.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/profile/profile.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/profile/profile.controller.js)
    *   Donor Update (Lines 234-258):
        ```javascript
        const updated = await prisma.donor.upsert({ ... });
        const completionPct = calcDonorCompletion(updated);
        // ...
        return res.status(200).json({
          status: "success",
          data: { profile: updated, completionPct, role: "DONOR" },
        });
        ```
    *   User Update (Lines 333-348):
        ```javascript
        const updated = await prisma.user.update({ where: { id }, data: updateData });
        // ...
        return res.status(200).json({
          status: "success",
          data: { profile: updated, completionPct, role: updated.role },
        });
        ```
*   **JSON Schema Payload Changes:**  
    *   **Current (Exposing Sensitive Data):**
        ```json
        {
          "status": "success",
          "data": {
            "profile": {
              "id": "67acb1c5d40f13b3be90f7f2",
              "email": "user@example.com",
              "password": "$2a$12$KjF68vHj92V...", // LEAKED
              "resetPasswordToken": "eyJhbG...", // LEAKED
              "verificationToken": "eyJhbG...", // LEAKED
              "name": "Jane Doe"
            }
          }
        }
        ```
    *   **Expected (Safe Payload):**
        ```json
        {
          "status": "success",
          "data": {
            "profile": {
              "id": "67acb1c5d40f13b3be90f7f2",
              "email": "user@example.com",
              "name": "Jane Doe"
            }
          }
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/profile/profile.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/profile/profile.controller.js).
    2. Navigate to `exports.updateMyProfile` (Line 149).
    3. Before returning the responses in the donor section (Line 255) and the user section (Line 345), convert the `updated` database document to a plain JavaScript object.
    4. Delete or set to `undefined` the following properties: `password`, `resetPasswordToken`, `resetPasswordExpiry`, `verificationToken`, and `verificationTokenExpiry`.
    5. Navigate to `exports.updateProfilePicture` (Line 354) and perform the same cleanup on the `updated` user/donor object before responding (Line 382).

---

### TICKET: DREAM-102 — Strip Hashed Passwords & System Tokens from Auth Payloads
*   **Issue Type:** Story (Security Vulnerability)
*   **Priority:** High
*   **Component:** Backend API / Auth
*   **User Story:**  
    *   **As a** logging-in user,  
    *   **I want** the authentication response payload to contain only my user metadata,  
    *   **So that** my active account verification or password reset keys are not exposed to the browser.
*   **Description:**  
    The `createAndSendToken` helper blanks out `user.password` but fails to clear active security tokens (`verificationToken` and `resetPasswordToken`), meaning they are sent in the payload on every successful login.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/auth/auth.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/auth/auth.controller.js) (Lines 29-41)
        ```javascript
        const createAndSendToken = (user, statusCode, res) => {
          const token = signToken(user.id);
          // Remove password from output
          user.password = undefined;

          res.status(statusCode).json({
            status: "success",
            token,
            data: {
              user,
            },
          });
        };
        ```
*   **JSON Schema Payload Changes:**  
    *   **Current (Exposing Sensitive Data):**
        ```json
        {
          "status": "success",
          "token": "eyJhbG...",
          "data": {
            "user": {
              "id": "67acb...",
              "email": "user@example.com",
              "verificationToken": "eyJhbG...", // LEAKED
              "resetPasswordToken": "eyJhbG..." // LEAKED
            }
          }
        }
        ```
    *   **Expected (Safe Payload):**
        ```json
        {
          "status": "success",
          "token": "eyJhbG...",
          "data": {
            "user": {
              "id": "67acb...",
              "email": "user@example.com"
            }
          }
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/auth/auth.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/auth/auth.controller.js).
    2. Go to the `createAndSendToken` helper function at Line 29.
    3. Add the following lines immediately after `user.password = undefined;` (Line 32):
       ```javascript
       user.verificationToken = undefined;
       user.verificationTokenExpiry = undefined;
       user.resetPasswordToken = undefined;
       user.resetPasswordExpiry = undefined;
       ```
    4. Save the file and verify tests pass.

---

### TICKET: DREAM-103 — Optimize Public Campaign & Opportunity List Payloads
*   **Issue Type:** Story (Performance Optimization)
*   **Priority:** Medium
*   **Component:** Backend API / Campaign Lists
*   **User Story:**  
    *   **As a** mobile app/website visitor,  
    *   **I want** public campaign search pages to load quickly,  
    *   **So that** my mobile data is not wasted on loading full descriptions, FAQs, and team lists for cards.
*   **Description:**  
    The endpoints `GET /api/user-projects/public` and `GET /api/donor-projects/public` lack root-level `select` statements in their Prisma queries. This causes the backend to send detailed description texts, team members arrays, and FAQs in public list responses, none of which are used by `CampaignCard.tsx` or `BrowseProjects.tsx`.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/user-projects/user-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/user-projects/user-project.controller.js) (Lines 479-491)
        ```javascript
        const rawProjects = await prisma.userProject.findMany({
          where: { status: 'APPROVED' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: limit + 1, 
          include: {
            club: { select: { id: true, name: true, college: true } },
            milestones: {
              orderBy: { order: 'asc' },
              select: { id: true, title: true, status: true, order: true, budget: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        ```
*   **JSON Schema Payload Changes:**  
    *   **Current (Excessive Fields):**
        ```json
        {
          "status": "success",
          "data": {
            "userProjects": [
              {
                "id": "123",
                "title": "Clean Water Initiative",
                "description": "Multi-kilobyte long markdown text detailing the project...", // BLOAT
                "teamMembers": [{"name": "John", "role": "lead"}], // BLOAT
                "faqs": [{"question": "Why?", "answer": "Because"}], // BLOAT
                "goalAmount": 50000,
                "amountRaised": 12000
              }
            ]
          }
        }
        ```
    *   **Expected (Slim Card Payload):**
        ```json
        {
          "status": "success",
          "data": {
            "userProjects": [
              {
                "id": "123",
                "title": "Clean Water Initiative",
                "goalAmount": 50000,
                "amountRaised": 12000,
                "imageUrl": "https://cloudinary...",
                "rating": 5,
                "club": { "name": "Eco Club", "college": "GCT" },
                "milestones": [{ "id": "m1" }]
              }
            ]
          }
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/user-projects/user-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/user-projects/user-project.controller.js).
    2. Go to the `getPublicUserProjects` controller function at Line 467.
    3. Modify the `prisma.userProject.findMany` query to replace the root query (use `select` instead of fetching the entire model):
       ```javascript
       const rawProjects = await prisma.userProject.findMany({
         where: { status: 'APPROVED' },
         ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
         take: limit + 1, 
         select: {
           id: true,
           title: true,
           imageUrl: true,
           goalAmount: true,
           amountRaised: true,
           rating: true,
           userId: true,
           createdAt: true,
           club: { select: { id: true, name: true, college: true } },
           milestones: { select: { id: true } } // only fetch IDs to compute milestones.length
         },
         orderBy: { createdAt: 'desc' },
       });
       ```
    4. Open [server/src/api/donor-projects/donor-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.controller.js) and perform the same change on `getPublicDonorProjects` at Line 218, selecting only `id`, `title`, `imageUrl`, `organization`, `skillsRequired`, `timeline` and removing the full `description` text.

---

### TICKET: DREAM-104 — Securely Implement Student Application Counter on Opportunity Cards
*   **Issue Type:** Story / Bug (Privacy & UI Desync)
*   **Priority:** High
*   **Component:** Backend API / Opportunities
*   **User Story:**  
    *   **As a** student seeking sponsorships,  
    *   **I want** to see the correct count of applicants on Opportunity cards without my private cover letter being leaked,  
    *   **So that** my personal data remains confidential.
*   **Description:**  
    The opportunity cards try to display the count of applied students via `project.interestedUsers?.length` which currently resolves to 0 because the backend does not fetch application counts. To prevent leaking student cover letters and contact info publicly, we need to query only the relation count using Prisma's `_count` aggregation.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/donor-projects/donor-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.controller.js) (Lines 218-232)
        ```javascript
        exports.getPublicDonorProjects = catchAsync(async (req, res, next) => {
          const donorProjects = await prisma.donorProject.findMany({
            where: { status: 'APPROVED' },
            include: {
              donor: { select: { id: true, name: true, organizationName: true } },
            },
            orderBy: { createdAt: 'desc' },
          });
        ```
*   **JSON Schema Payload Changes:**  
    *   **Current Response (0 Applicants):**
        ```json
        {
          "id": "123",
          "title": "AI Grant Opportunity",
          "donor": { "name": "Intel" }
          // Missing application count data entirely
        }
        ```
    *   **Expected Response (Safe Count Included):**
        ```json
        {
          "id": "123",
          "title": "AI Grant Opportunity",
          "donor": { "name": "Intel" },
          "_count": {
            "applications": 14
          }
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/donor-projects/donor-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.controller.js).
    2. Go to `getPublicDonorProjects` at Line 218.
    3. Modify the query include block to request the application count securely:
       ```javascript
       const donorProjects = await prisma.donorProject.findMany({
         where: { status: 'APPROVED' },
         include: {
           donor: { select: { id: true, name: true, organizationName: true } },
           _count: {
             select: { applications: true }
           }
         },
         orderBy: { createdAt: 'desc' },
       });
       ```
    4. Open the frontend mapper file [client/src/services/mappers.ts](file:///c:/ongoing_works/codes/Dreamxec/client/src/services/mappers.ts).
    5. Navigate to `mapDonorProjectToProject` (Line 157).
    6. Change `interestedUsers: []` to map the count payload as an array of placeholders to satisfy the length lookup:
       ```javascript
       interestedUsers: donorProject._count?.applications 
         ? Array(donorProject._count.applications).fill({}) 
         : [],
       ```

---

### TICKET: DREAM-105 — Transition OAuth Login Session Redirects to HttpOnly Cookies
*   **Issue Type:** Story (Security Vulnerability)
*   **Priority:** High
*   **Component:** Backend API / Auth
*   **User Story:**  
    *   **As a** social login user (Google/LinkedIn),  
    *   **I want** my authentication session tokens to be stored securely,  
    *   **So that** they cannot be harvested from the browser URL search query by third-party tracking scripts.
*   **Description:**  
    The Google and LinkedIn OAuth callbacks redirect users back to the frontend with the active authentication token in the query parameters (`?token=${token}`). These tokens can be easily leaked to external scripts via `Referer` headers.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/auth/auth.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/auth/auth.controller.js) (Lines 291-295)
        ```javascript
        const token = signToken(req.user.id);
        // Redirect to frontend with token
        res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/auth/auth.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/auth/auth.controller.js).
    2. Go to `googleCallback` (Line 272) and `linkedinCallback` (Line 324).
    3. Instead of appending the token to the URL query string and doing a redirect, set the token in a secure cookie:
       ```javascript
       const token = signToken(req.user.id);
       
       res.cookie('dreamxec_token', token, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'lax',
         maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days matching JWT expiry
       });
       
       res.redirect(`${process.env.CLIENT_URL}/auth/callback`);
       ```
    4. Coordinate with the frontend team to modify the token loader to read the cookie instead of checking URL search parameters.

---

### TICKET: DREAM-106 — Redact Sensitive Bank Details in Admin Withdrawal Lists
*   **Issue Type:** Story (Security Vulnerability / Compliance)
*   **Priority:** High
*   **Component:** Backend API / Admin Panel
*   **User Story:**  
    *   **As a** student withdrawing campaign funds,  
    *   **I want** my bank account number to be redacted on lists,  
    *   **So that** my private financial details are not exposed to unauthorised viewers.
*   **Description:**  
    The endpoint `GET /api/admin/withdrawals` joins the full `bankAccount` model object. This exposes raw bank account numbers directly in list responses for all withdrawal requests.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/admin/admin.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin/admin.controller.js) (Lines 800-813)
        ```javascript
        const withdrawals = await prisma.withdrawal.findMany({
          where: { status },
          include: {
            userProject: {
              select: {
                title: true,
                amountRaised: true,
                user: { select: { name: true, email: true } },
                bankAccount: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        ```
*   **JSON Schema Payload Changes:**  
    *   **Current (Exposing Raw Bank Numbers):**
        ```json
        {
          "id": "w1",
          "amount": 25000,
          "userProject": {
            "bankAccount": {
              "accountHolderName": "John Doe",
              "accountNumber": "912010023901920", // SECURE DATA LEAKED
              "bankName": "HDFC"
            }
          }
        }
        ```
    *   **Expected (Masked Bank Number):**
        ```json
        {
          "id": "w1",
          "amount": 25000,
          "userProject": {
            "bankAccount": {
              "accountHolderName": "John Doe",
              "accountNumber": "***********1920", // SECURED
              "bankName": "HDFC"
            }
          }
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/admin/admin.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin/admin.controller.js).
    2. Navigate to the `getWithdrawals` controller function (Line 797).
    3. Modify the list response logic by mapping the returned list and masking the bank account number before sending:
       ```javascript
       const sanitizedWithdrawals = withdrawals.map(w => {
         const record = { ...w };
         if (record.userProject?.bankAccount) {
           const account = record.userProject.bankAccount;
           account.accountNumber = `***********${account.accountNumber.slice(-4)}`;
         }
         return record;
       });
       
       res.status(200).json({
         status: 'success',
         results: sanitizedWithdrawals.length,
         data: { withdrawals: sanitizedWithdrawals }
       });
       ```

---

### TICKET: DREAM-107 — Optimize Admin Verification & Referral Tables Payload
*   **Issue Type:** Story (Performance Optimization / Privacy)
*   **Priority:** Medium
*   **Component:** Backend API / Admin Panel
*   **User Story:**  
    *   **As a** platform administrator,  
    *   **I want** verification request lists to load quickly without downloading private contact documents in bulk,  
    *   **So that** I can review applications efficiently.
*   **Description:**  
    The admin list endpoints for club verifications and referrals fetch and return the complete database documents (including `studentPhone`, `studentEmail`, `ficEmail`, `ficPhone`, and massive stringified `alumni` JSON arrays) which are not rendered in list grids.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/admin-club/adminClubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin-club/adminClubVerification.controller.js) (Lines 6-18)
        ```javascript
        exports.listVerifications = async (req, res) => {
          const { status, skip = 0, take = 50 } = req.query;
          const where = {};
          if (status) where.status = status;
          const list = await prisma.clubVerification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: Number(skip),
            take: Number(take),
          });
          res.json({ success: true, data: list });
        };
        ```
*   **JSON Schema Payload Changes:**  
    *   **Current (Excessive & Unsafe Data):**
        ```json
        {
          "success": true,
          "data": [
            {
              "id": "v1",
              "clubName": "Robotics Club",
              "presidentName": "Alice",
              "studentPhone": "+9188888888", // LEAKED
              "ficPhone": "+9199999999", // LEAKED
              "alumni": [{"name": "Alumnus 1", "year": "2020"}, ...] // LEAKED LARGE JSON ARRAY
            }
          ]
        }
        ```
    *   **Expected (Slim Admin Grid Payload):**
        ```json
        {
          "success": true,
          "data": [
            {
              "id": "v1",
              "clubName": "Robotics Club",
              "collegeName": "IIT Delhi",
              "presidentName": "Alice",
              "status": "PENDING",
              "createdAt": "2026-06-26T20:00:00.000Z"
            }
          ]
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/admin-club/adminClubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin-club/adminClubVerification.controller.js).
    2. Go to `listVerifications` at Line 6.
    3. Add a `select` statement to the `findMany` call to retrieve only basic listing fields:
       ```javascript
       const list = await prisma.clubVerification.findMany({
         where,
         select: {
           id: true,
           clubName: true,
           collegeName: true,
           presidentName: true,
           status: true,
           createdAt: true
         },
         orderBy: { createdAt: "desc" },
         skip: Number(skip),
         take: Number(take),
       });
       ```
    4. Repeat the same selection logic in [server/src/api/club-verification/clubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-verification/clubVerification.controller.js) (Line 95) and [server/src/api/club-referral/clubReferral.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-referral/clubReferral.controller.js) (Line 80) to optimize their list endpoints.

---

### TICKET: DREAM-108 — Optimize Club Campaign Retrieval API Payloads
*   **Issue Type:** Story (Performance Optimization)
*   **Priority:** Medium
*   **Component:** Backend API / Clubs
*   **User Story:**  
    *   **As a** club president or site reviewer,  
    *   **I want** club campaign dashboard list pages to retrieve only cards-level metadata,  
    *   **So that** my browser does not consume bandwidth loading nested FAQs, descriptions, and team structures for card grids.
*   **Description:**  
    The club campaign retrieval endpoints for approved, pending, and rejected campaigns, along with public club details campaign queries, lack a `select` statement. This results in heavy, unneeded columns like description, teamMembers, and faqs being serialized and sent in list responses, none of which are rendered by the client's `PresidentCampaigns.tsx` cards.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/clubs/club.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/clubs/club.controller.js) (Lines 540-546, 604-610, 670-676, 818-826)
        ```javascript
        const campaigns = await prisma.userProject.findMany({
          where: {
            userId: { in: userIds },
            status: 'APPROVED'
          },
          orderBy: { createdAt: 'desc' }
        });
        ```
*   **JSON Schema Payload Changes:**  
    *   **Current Response (Bloated with Descriptions & Nested JSON):**
        ```json
        {
          "status": "success",
          "data": [
            {
              "id": "c1",
              "title": "Robotics Kit Financing",
              "description": "Extremely long multiline details...",
              "teamMembers": [{"name": "Alice", "role": "Lead"}],
              "faqs": [{"q": "Why?", "a": "Yes"}],
              "goalAmount": 10000,
              "amountRaised": 2000
            }
          ]
        }
        ```
    *   **Expected Response (Slim Card Fields):**
        ```json
        {
          "status": "success",
          "data": [
            {
              "id": "c1",
              "title": "Robotics Kit Financing",
              "imageUrl": "https://...",
              "goalAmount": 10000,
              "amountRaised": 2000,
              "rating": 5
            }
          ]
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/clubs/club.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/clubs/club.controller.js).
    2. Navigate to `getApprovedClubCampaigns` (Line 503).
    3. Modify `prisma.userProject.findMany` (Line 540) to include a `select` block fetching only:
       ```javascript
       select: {
         id: true,
         title: true,
         imageUrl: true,
         goalAmount: true,
         amountRaised: true,
         rating: true,
         userId: true,
         createdAt: true
       }
       ```
    4. Apply the exact same select projection to `getPendingClubCampaigns` (Line 561) at the query at Line 604 and `getRejectedClubCampaigns` (Line 627) at the query at Line 670.
    5. Navigate to `getPublicClubById` (Line 799) and modify the `prisma.userProject.findMany` query (Line 818) to use the same select projection.

---

### TICKET: DREAM-109 — Secure Student Verification Workflow and Fix Status Revocation
*   **Issue Type:** Story (Security Vulnerability)
*   **Priority:** High
*   **Component:** Backend API / Student Verification
*   **User Story:**  
    *   **As a** platform administrator,  
    *   **I want** student verification requests to remain in PENDING status until I manually approve their documents,  
    *   **So that** unverified users cannot bypass the KYC check, and rejected verifications immediately revoke campaign creation permissions.
*   **Description:**  
    When a student submits verification documents via `verify` (post-payment callback), the server immediately updates the user's `studentVerified` and `canCreateCampaign` fields to `true`, and stores the request status as `VERIFIED` instead of `PENDING`. Furthermore, when an admin rejects the verification request via `rejectStudentVerification`, the request status changes to `REJECTED` but the user's `studentVerified` and `canCreateCampaign` flags are never set to `false`, leaving the user verified despite rejection.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/studentVerification/studentverfication.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/studentVerification/studentverfication.controller.js) (Lines 95-103, 117, 210-217)
    *   Submission logic (Lines 95-103):
        ```javascript
        await tx.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                hasPaid: true,
                studentVerified: true,
                canCreateCampaign: true 
            }
        });
        ```
    *   Rejection logic (Lines 210-217):
        ```javascript
        const updatedVerification = await prisma.studentVerification.update({
            where: { id },
            data: {
                status: 'REJECTED',
                updatedAt: new Date()
            }
        });
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/studentVerification/studentverfication.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/studentVerification/studentverfication.controller.js).
    2. Go to the `verify` function (Line 52) and locate the transaction blocks (Lines 90-120).
    3. Modify `tx.user.update` data (Line 95) to NOT set `studentVerified` or `canCreateCampaign` to `true`. They must remain `false` or unmodified (keep `emailVerified: true` and `hasPaid: true`).
    4. Modify `tx.studentVerification.create` data (Line 105) so that `status` is set to `"PENDING"` instead of `"VERIFIED"` (Line 117).
    5. Go to the `rejectStudentVerification` function (Line 198).
    6. Replace the request update logic with a Prisma `$transaction` that:
       *   Updates the `studentVerification` status to `'REJECTED'` (Line 214).
       *   Updates the corresponding `User` record to set `studentVerified: false` and `canCreateCampaign: false`:
       ```javascript
       await prisma.$transaction([
         prisma.studentVerification.update({
           where: { id },
           data: { status: 'REJECTED', updatedAt: new Date() }
         }),
         prisma.user.update({
           where: { id: verificationRequest.userId },
           data: { studentVerified: false, canCreateCampaign: false }
         })
       ]);
       ```

---

### TICKET: DREAM-110 — Strip Hashed Passwords and Sensitive Tokens from Admin and Status API Responses
*   **Issue Type:** Story (Security Vulnerability)
*   **Priority:** High
*   **Component:** Backend API / Admin Panel
*   **User Story:**  
    *   **As an** administrator or donor,  
    *   **I want** my account's hashed credentials, PAN numbers, and verification tokens to be hidden from dashboard list/status API responses,  
    *   **So that** these secrets are not exposed to client web panels.
*   **Description:**  
    The admin endpoints for checking user details, changing user/donor statuses, and verifying donors return the raw database objects directly. Because these tables contain password hashes, reset tokens, and PAN cards, this details leak opens a vector for password cracking or token hijacking.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/admin/admin.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin/admin.controller.js) (Lines 475, 619, 1160, 1185, 1245-1260)
        ```javascript
        const user = await prisma.user.update({
          where: { id: req.params.id },
          data: { accountStatus: status }
        });
        res.status(200).json({ status: 'success', data: { user } });
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/admin/admin.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin/admin.controller.js).
    2. Locate `getUserDetails` (Line 1244). Exclude sensitive fields from the fetched user object (e.g. set `user.password = undefined; user.verificationToken = undefined; user.resetPasswordToken = undefined;`) before sending it.
    3. Locate both declarations of `manageUserStatus` (Line 451 and Line 607) and sanitize `user.password`, `user.verificationToken`, `user.resetPasswordToken` etc. by setting them to `undefined` before calling `res.json`.
    4. Locate `verifyDonor` (Line 1141) and `manageDonorStatus` (Line 1164) and sanitize the `donor` object, specifically setting `donor.password`, `donor.panNumber`, `donor.verificationToken`, `donor.resetPasswordToken` to `undefined` before sending.

---

### TICKET: DREAM-111 — Clean Duplicate Functions and Resolve Schema Mismatches in Admin Endpoints
*   **Issue Type:** Story (Technical Debt / Critical Bug)
*   **Priority:** High
*   **Component:** Backend API / Admin Panel
*   **User Story:**  
    *   **As an** operations team member,  
    *   **I want** the admin endpoints for uploading club members, getting club members, and updating club status to function without throwing database crashes,  
    *   **So that** club administration actions are reliable.
*   **Description:**  
    1. Duplicate Code: The functions `manageUserStatus`, `getAllClubs`, and `manageClubStatus` are duplicated in `admin.controller.js`.
    2. Model Crash: `uploadClubMembers` and `getClubMembers` query `prisma.clubMembership`, which does not exist in `schema.prisma`. It must be changed to `prisma.clubMember`.
    3. Field Crash: `manageClubStatus` attempts to update `Club` with `{ status }`, but the `Club` model has no `status` field in the database schema.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/admin/admin.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin/admin.controller.js) (Lines 451-522, 606-649, 659-756)
        ```javascript
        await prisma.clubMembership.create({ ... }) // ClubMembership doesn't exist
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/admin/admin.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin/admin.controller.js).
    2. Delete the duplicated block at Lines 604-649 entirely. Keep only the single, clean declarations of `manageUserStatus`, `getAllClubs`, and `manageClubStatus`.
    3. In the remaining `manageClubStatus` function, remove this endpoint or add `status` to the `Club` model in [server/prisma/schema.prisma](file:///c:/ongoing_works/codes/Dreamxec/server/prisma/schema.prisma) and run a migration, as the current schema lacks this field.
    4. In `uploadClubMembers` (Line 659) and `getClubMembers` (Line 745), replace all instances of `prisma.clubMembership` with `prisma.clubMember`.

---

### TICKET: DREAM-112 — Secure Commenter Auth Details Leak in Campaign Comments API
*   **Issue Type:** Story (Security Vulnerability)
*   **Priority:** High
*   **Component:** Backend API / Campaign Comments
*   **User Story:**  
    *   **As a** campaign commenter,  
    *   **I want** my account's password hashes and tokens to be stripped from comments creation responses,  
    *   **So that** my authentication secrets are not exposed to the public.
*   **Description:**  
    When creating a comment, the database repository executes `prisma.campaignComment.create` with `include: { user: true, donor: true }`. Since there is no selective projection, the server returns commenter credentials (hashed password, tokens) directly in the response payload when sending the comment object.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/campaign-comments/campaignComment.repository.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/campaign-comments/campaignComment.repository.js) (Lines 14-19)
        ```javascript
        async create(data) {
          return prisma.campaignComment.create({
            data,
            include: { user: true, donor: true },
          });
        }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/campaign-comments/campaignComment.repository.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/campaign-comments/campaignComment.repository.js).
    2. Locate `create(data)` (Line 14).
    3. Modify the `include` block to explicitly select only public-facing user/donor fields:
       ```javascript
       async create(data) {
         return prisma.campaignComment.create({
           data,
           include: {
             user: {
               select: { id: true, name: true, profilePicture: true, role: true }
             },
             donor: {
               select: { id: true, name: true, profilePicture: true }
             }
           },
         });
       }
       ```
    4. Go to `findByCampaign` (Line 21) and modify its `include` in the same way for alignment.

---

### TICKET: DREAM-113 — Fix Schema Mismatch Crashes in Admin Club Approval and Rejection Flow
*   **Issue Type:** Bug (Operational Crash)
*   **Priority:** High
*   **Component:** Backend API / Admin Clubs
*   **User Story:**  
    *   **As an** administrator,  
    *   **I want** to reject club verification and referral requests without causing database runtime crashes,  
    *   **So that** my administrative operations run smoothly.
*   **Description:**  
    The rejection controllers for both club verifications and club referrals attempt to write values to `rejectionReason`, `reviewedBy`, and `reviewedAt` fields in the `ClubVerification` and `ClubReferralRequest` models. However, these fields are absent from [server/prisma/schema.prisma](file:///c:/ongoing_works/codes/Dreamxec/server/prisma/schema.prisma), causing Prisma to throw a database schema validation error and crash the request at runtime.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/admin-club/adminClubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin-club/adminClubVerification.controller.js) (Lines 137-142):
        ```javascript
        data: {
          status: "REJECTED",
          rejectionReason: reason || "No reason specified",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        }
        ```
    *   File Path: [server/src/api/club-referral/clubReferral.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-referral/clubReferral.controller.js) (Line 102):
        ```javascript
        data:{ status: 'REJECTED', rejectionReason: reason }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/prisma/schema.prisma](file:///c:/ongoing_works/codes/Dreamxec/server/prisma/schema.prisma).
    2. Add the following fields to the `ClubVerification` model:
       ```prisma
       rejectionReason String?
       reviewedBy      String? @db.ObjectId
       reviewedAt      DateTime?
       ```
    3. Add the following field to the `ClubReferralRequest` model:
       ```prisma
       rejectionReason String?
       ```
    4. Run a Prisma migration to apply the schema updates:
       ```bash
       npx prisma db push
       ```
    5. Clean up duplicate rejection functions inside `adminClubReferral.controller.js` and `clubReferral.controller.js`.

---

### TICKET: DREAM-114 — Mount Dead Subscription Endpoints and Fix Missing Environment Configs
*   **Issue Type:** Bug (Operational Dead-End)
*   **Priority:** High
*   **Component:** Backend API / Subscriptions
*   **User Story:**  
    *   **As a** student seeking platform membership,  
    *   **I want** subscription creation and webhook endpoints to be reachable on the server,  
    *   **So that** my paid account upgrades function correctly.
*   **Description:**  
    The entire subscription module located at [server/src/api/subscription](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/subscription) is unmounted. `server.js` never imports or registers the subscription router, making `/api/subscription` return 404. Furthermore, the controller references non-existent environment variables (`RZP_KEY_ID`, `RZP_KEY_SECRET`, and `RZP_PLAN_ID`), causing failures on startup.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/subscription/subscription.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/subscription/subscription.controller.js) (Lines 4-11):
        ```javascript
        const razorpay = new Razorpay({
          key_id: process.env.RZP_KEY_ID,
          key_secret: process.env.RZP_KEY_SECRET
        });
        ...
        const planId = process.env.RZP_PLAN_ID;
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/server.js](file:///c:/ongoing_works/codes/Dreamxec/server/server.js).
    2. Import the subscription router at the top:
       ```javascript
       const subscriptionRoutes = require("./src/api/subscription/subscription.routes");
       ```
    3. Register the router under the API routes section:
       ```javascript
       app.use("/api/subscription", subscriptionRoutes);
       ```
    4. Open [server/src/api/subscription/subscription.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/subscription/subscription.controller.js).
    5. Update lines 5-6 to use `process.env.RAZORPAY_KEY_ID` and `process.env.RAZORPAY_KEY_SECRET` respectively.
    6. Open [server/.env](file:///c:/ongoing_works/codes/Dreamxec/server/.env) and define `RAZORPAY_PLAN_ID` (replacing RZP_PLAN_ID in the controller).

---

### TICKET: DREAM-115 — Mount Webhook Router and Fix Webhook Signature Verification
*   **Issue Type:** Bug (Operational Dead-End / Security Check Bypass)
*   **Priority:** High
*   **Component:** Backend API / Webhooks
*   **User Story:**  
    *   **As a** payment processing service,  
    *   **I want** captured payment webhook requests to be processed securely,  
    *   **So that** donations are updated immediately when completed.
*   **Description:**  
    1. Unmounted Router: The webhook endpoints in [server/src/api/webhook](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/webhook) are not imported or mounted in `server.js`.
    2. Signature Bypass: Standard Express parsing parses `req.body` to an object, meaning `JSON.stringify(req.body)` inside the controller signature check fails to match the raw payload sent by Razorpay, causing signature verification failure.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/webhook/webhook.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/webhook/webhook.controller.js) (Lines 9-12):
        ```javascript
        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(body)
          .digest("hex");
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/server.js](file:///c:/ongoing_works/codes/Dreamxec/server/server.js).
    2. Register the webhook router at `/api/webhook` using the raw Express parser:
       ```javascript
       app.use(
         "/api/webhook",
         express.raw({ type: "application/json" }),
         require("./src/api/webhook/webhook.routes")
       );
       ```
       *(Place this route BEFORE `app.use(express.json())` so the raw body parser is applied first!)*
    3. Modify `handleRazorpayWebhook` inside [webhook.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/webhook/webhook.controller.js) to read the raw body string directly from `req.body.toString('utf8')` instead of doing `JSON.stringify`.

---

### TICKET: DREAM-116 — Fix Mismatched Auth Protection on Opportunity View Details Route
*   **Issue Type:** Bug (Logical Lockout)
*   **Priority:** High
*   **Component:** Backend API / Opportunities
*   **User Story:**  
    *   **As an** unauthenticated guest,  
    *   **I want** to view opportunity details pages without being forced to log in,  
    *   **So that** I can read descriptions before deciding to register.
*   **Description:**  
    The GET single opportunity route `/:id` is mounted after the `protect` authentication middleware. However, the controller itself contains logic to allow public guests to view approved opportunities. This structural ordering mistake completely locks out guest visitors from opportunity details.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/donor-projects/donor-project.routes.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.routes.js) (Line 42):
        ```javascript
        router.use(protect); // Line 16
        ...
        router.get('/:id', donorProjectController.getDonorProject); // Line 42
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/donor-projects/donor-project.routes.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.routes.js).
    2. Move the route declaration `router.get('/:id', donorProjectController.getDonorProject);` to the top of the file under the PUBLIC routes section (above `router.use(protect);`).
    3. Open [server/src/api/donor-projects/donor-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.controller.js) and wrap the Sentry/Event publish call in `getDonorProject` inside an `if (req.user)` check to prevent it from crashing when guests view it.

---

### TICKET: DREAM-117 — Fix MongoDB Raw Insert and Swap Event Bug in Opportunity Creation
*   **Issue Type:** Bug (Logical Mismatch)
*   **Priority:** High
*   **Component:** Backend API / Opportunities
*   **User Story:**  
    *   **As a** donor,  
    *   **I want** my created opportunities to map correctly to my profile identity,  
    *   **So that** my opportunities are linked and I don't trigger invalid email notifications on detail views.
*   **Description:**  
    1. Serialization Error: `createDonorProject` writes to MongoDB using a raw command `$runCommandRaw`, passing `donorId` as a raw string instead of a database `ObjectId`. This breaks relation fetches (`include: { donor: true }`) for this record.
    2. Swap Error: The controller emits a `CAMPAIGN_CREATED` event inside `getDonorProject` (GET detail endpoint) instead of `createDonorProject` (POST endpoint). This floods email channels on every page view and crashes if loaded by guests (since `req.user` is undefined).
*   **Original Code Segment:**  
    *   File Path: [server/src/api/donor-projects/donor-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.controller.js) (Lines 39-56):
        ```javascript
        const result = await prisma.$runCommandRaw({
          insert: 'DonorProject',
          documents: [ ... ]
        });
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/donor-projects/donor-project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/donor-projects/donor-project.controller.js).
    2. Replace the `$runCommandRaw` code block (Lines 39-56) with standard Prisma create logic to ensure correct casting to ObjectIds:
       ```javascript
       const newProject = await prisma.donorProject.create({
         data: {
           title,
           description,
           organization: organization || null,
           skillsRequired: skillsRequired || [],
           timeline: timeline || null,
           totalBudget,
           imageUrl: imageUrl || null,
           donorId,
           status: 'PENDING'
         }
       });
       ```
    3. Remove the `publishEvent` call for `EVENTS.CAMPAIGN_CREATED` from `getDonorProject` (Lines 205-210) and move it to `createDonorProject` immediately after successful creation.

---

### TICKET: DREAM-118 — Prevent DB Connection Exhaustion from Direct PrismaClient Instantiations
*   **Issue Type:** Story (Performance Optimization / Stability)
*   **Priority:** Medium
*   **Component:** Database / Prisma Config
*   **User Story:**  
    *   **As an** operations developer,  
    *   **I want** controllers to share a single cached database connection,  
    *   **So that** MongoDB does not hit its connection limit and reject requests under traffic.
*   **Description:**  
    `wishlist.controller.js` and `joinRequest.controller.js` import `PrismaClient` and instantiate `new PrismaClient()` directly. Spawning multiple clients creates separate database connection pools, leaking connections.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/wishlist/wishlist.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/wishlist/wishlist.controller.js) (Lines 1-2):
        ```javascript
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/wishlist/wishlist.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/wishlist/wishlist.controller.js) and [server/src/api/clubs/joinRequest.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/clubs/joinRequest.controller.js).
    2. Remove `const { PrismaClient } = require('@prisma/client');` and `const prisma = new PrismaClient();`.
    3. Replace with the application singleton import:
       ```javascript
       const prisma = require('../../config/prisma');
       ```

---

### TICKET: DREAM-119 — Resolve Infinite Request Hanging in Newsletter Re-subscription
*   **Issue Type:** Bug (Operational Error)
*   **Priority:** High
*   **Component:** Backend API / Newsletter
*   **User Story:**  
    *   **As a** re-subscribing user,  
    *   **I want** my newsletter subscription requests to complete successfully,  
    *   **So that** my browser does not hang infinitely.
*   **Description:**  
    Inside `subscribe`, when a previously unsubscribed user tries to resubscribe, the controller returns the update promise but never calls `res.json()`. This leaves the HTTP connection hanging indefinitely.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/newsletter/newsletter.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/newsletter/newsletter.controller.js) (Lines 44-51):
        ```javascript
        if (existing) {
          if (!existing.isActive) {
            return await prisma.subscriber.update({ ... });
          }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/newsletter/newsletter.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/newsletter/newsletter.controller.js).
    2. Modify the block at Lines 44-51 to send a response back to the client:
       ```javascript
       if (existing) {
         if (!existing.isActive) {
           const updated = await prisma.subscriber.update({
             where: { email },
             data: { isActive: true, source }
           });
           return res.status(200).json({
             success: true,
             message: 'Resubscribed successfully',
             data: { subscriber: updated }
           });
         }
       ```

---

### TICKET: DREAM-120 — Resolve Inconsistent Database Payment Status Values
*   **Issue Type:** Bug (Data Integrity)
*   **Priority:** Medium
*   **Component:** Backend API / Payments
*   **User Story:**  
    *   **As a** system auditor,  
    *   **I want** payment status columns to hold consistent states,  
    *   **So that** client dashboards accurately calculate total amounts raised.
*   **Description:**  
    The database tracks payment statuses differently across multiple files: `payment.controller.js` writes `"SUCCESS"`, `webhook.controller.js` writes `"PAID"`, and `donation.controller.js` writes `"completed"`. This state pollution breaks listing metrics.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/payments/payment.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/payments/payment.controller.js) (Line 70):
        ```javascript
        data: { paymentStatus: "SUCCESS", razorpayPaymentId: id }
        ```
    *   File Path: [server/src/api/webhook/webhook.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/webhook/webhook.controller.js) (Line 34):
        ```javascript
        data: { paymentStatus: "PAID" }
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Align all payment controllers to write a unified status. The standard across `donation.controller.js` and `payments` is `"completed"`.
    2. Open [server/src/api/payments/payment.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/payments/payment.controller.js). Modify Line 70 to write `"completed"` instead of `"SUCCESS"`.
    3. Open [server/src/api/webhook/webhook.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/webhook/webhook.controller.js). Modify Line 34 to write `"completed"` instead of `"PAID"`.

---

### TICKET: DREAM-121 — Fix OTP Verification Failures due to Raw vs Normalized Phone Lookup
*   **Issue Type:** Bug (Functional Blockage)
*   **Priority:** High
*   **Component:** Backend API / OTP
*   **User Story:**  
    *   **As a** registering student,  
    *   **I want** my verified phone OTP record to match during verification checkout,  
    *   **So that** I don't get blocked with mismatch messages.
*   **Description:**  
    In `createOrder`, the phone is normalized using `mobileNumber.replace(/\D/g, '')` before checking Redis, but the final `verify` check fetches the raw phone key `verified:phone:${mobileNumber}`. If the phone was sent with symbols, the check fails.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/studentVerification/studentverfication.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/studentVerification/studentverfication.controller.js) (Line 72):
        ```javascript
        const phoneVerified = await redis.get(`verified:phone:${mobileNumber}`);
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Open [server/src/api/studentVerification/studentverfication.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/studentVerification/studentverfication.controller.js).
    2. Go to the `verify` function at Line 52.
    3. Normalize `mobileNumber` before making the Redis lookup, matching `createOrder`:
       ```javascript
       const normalizedMobile = mobileNumber.replace(/\D/g, '');
       const phoneVerified = await redis.get(`verified:phone:${normalizedMobile}`);
       ```

---

### TICKET: DREAM-122 — Delete Dead Code and Invalid Projects API Folder
*   **Issue Type:** Technical Debt (Codebase Cleanup)
*   **Priority:** Low
*   **Component:** Backend API / Cleanup
*   **Description:**  
    The folder `server/src/api/projects` contains endpoints referencing a non-existent database model `Project`. It is completely dead code, not imported or mounted anywhere in `server.js`. Having this folder in the codebase increases complexity and confuses developers.
*   **Original Code Segment:**  
    *   File Path: [server/src/api/projects/project.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/projects/project.controller.js)
        ```javascript
        const project = await prisma.project.create({ ... })
        ```
*   **Step-by-Step Developer Implementation Instructions:**  
    1. Delete the folder [server/src/api/projects](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/projects) from the repository.

---

### TICKET: DREAM-123 — Clean Up Unused App1.tsx Component in Client Project
*   **Issue Type:** Technical Debt (Codebase Cleanup)
*   **Priority:** Low
*   **Component:** Frontend / Client
*   **User Story:**  
    *   **As a** new developer,  
    *   **I want** unused layout components to be removed from the project workspace,  
    *   **So that** I don't get confused about which file is the true React application shell.
*   **Description:**  
    During earlier iterations of the UI design, a backup app shell file called `App1.tsx` was created. The true application entry point is `App.tsx`. The file `App1.tsx` is dead code and is never imported or mounted by `main.tsx`.
*   **Original File:**  
    *   File Path: [client/src/App1.tsx](file:///c:/ongoing_works/codes/Dreamxec/client/src/App1.tsx)
*   **Step-by-Step Intern Implementation Instructions:**  
    1. Delete the file [client/src/App1.tsx](file:///c:/ongoing_works/codes/Dreamxec/client/src/App1.tsx) from the codebase.
    2. Run `npm run dev` in the client directory to make sure the app compiles successfully without errors.

---

### TICKET: DREAM-124 — Clean Up Unused Development & Support Scripts in Server Project
*   **Issue Type:** Technical Debt (Codebase Cleanup)
*   **Priority:** Low
*   **Component:** Backend / Server
*   **User Story:**  
    *   **As a** fresher developer,  
    *   **I want** outdated one-time scripts to be removed from the root directory,  
    *   **So that** the project root folder remains clean.
*   **Description:**  
    The scripts `auto-fix-zod.cjs` and `cleanup-applications.js` in the root of the server project are outdated. They were run once by the core developers to fix files during creation, are not used in production or local package.json scripts, and should be removed.
*   **Original Files:**  
    *   File Path: [server/auto-fix-zod.cjs](file:///c:/ongoing_works/codes/Dreamxec/server/auto-fix-zod.cjs)
    *   File Path: [server/cleanup-applications.js](file:///c:/ongoing_works/codes/Dreamxec/server/cleanup-applications.js)
*   **Step-by-Step Intern Implementation Instructions:**  
    1. Delete the file [server/auto-fix-zod.cjs](file:///c:/ongoing_works/codes/Dreamxec/server/auto-fix-zod.cjs).
    2. Delete the file [server/cleanup-applications.js](file:///c:/ongoing_works/codes/Dreamxec/server/cleanup-applications.js).

---

### TICKET: DREAM-125 — Eliminate Duplicate Club Referral Logic across Controllers
*   **Issue Type:** Technical Debt (Refactoring)
*   **Priority:** High
*   **Component:** Backend / Club Referrals
*   **User Story:**  
    *   **As a** developer,  
    *   **I want** club referral approval and rejection logic to reside in a single place,  
    *   **So that** we do not maintain duplicate copies of the same logic.
*   **Description:**  
    The logic to retrieve, approve, and reject club referrals is duplicated across two files: `clubReferral.controller.js` and `adminClubReferral.controller.js`. This duplication led to bugs (like writing to the non-existent field `rejectionReason` in database queries in both places).
*   **Original Files:**  
    *   File Path: [clubReferral.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-referral/clubReferral.controller.js) (Lines 80-104)
    *   File Path: [adminClubReferral.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin-club/adminClubReferral.controller.js) (whole file)
*   **Step-by-Step Intern Implementation Instructions:**  
    1. Open [server/src/api/club-referral/clubReferral.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-referral/clubReferral.controller.js).
    2. Scroll to the bottom and delete the duplicated helper methods `listReferrals`, `getReferral`, `approveReferral`, and `rejectReferral` (Lines 80-104). Keep only the primary student referral submission logic (`referClub`).
    3. Open [server/src/api/club-referral/clubReferral.routes.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-referral/clubReferral.routes.js).
    4. Update any routes that retrieve, approve, or reject referrals to import and call the functions inside [adminClubReferral.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin-club/adminClubReferral.controller.js) instead.

---

### TICKET: DREAM-126 — Eliminate Duplicate Club Verification Logic across Controllers
*   **Issue Type:** Technical Debt (Refactoring)
*   **Priority:** High
*   **Component:** Backend / Club Verifications
*   **User Story:**  
    *   **As a** developer,  
    *   **I want** the logic for approving and rejecting club verification requests to reside in a single controller,  
    *   **So that** we avoid copy-pasting code and bugs.
*   **Description:**  
    The logic to approve and reject club verifications is duplicate code copy-pasted across `clubVerification.controller.js` and `adminClubVerification.controller.js`.
*   **Original Files:**  
    *   File Path: [clubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-verification/clubVerification.controller.js) (Lines 94-189)
    *   File Path: [adminClubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin-club/adminClubVerification.controller.js) (whole file)
*   **Step-by-Step Intern Implementation Instructions:**  
    1. Open [server/src/api/club-verification/clubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-verification/clubVerification.controller.js).
    2. Scroll to Line 94 and delete the duplicated helper methods `listVeridications`, `approveVerification`, and `rejectVerification` (Lines 94-189). Keep only the student submission controller (`submitClubVerification`).
    3. Open [server/src/api/club-verification/clubVerification.routes.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/club-verification/clubVerification.routes.js).
    4. Update routes that perform verification queries, approvals, or rejections to import and use [adminClubVerification.controller.js](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/admin-club/adminClubVerification.controller.js) instead.

---

### TICKET: DREAM-127 — Remove Empty Search API Files
*   **Issue Type:** Technical Debt (Codebase Cleanup)
*   **Priority:** Low
*   **Component:** Backend / Search
*   **Description:**  
    The search API directory contains placeholder files `search.controller.js`, `search.routes.js`, and `search.validation.js` which are completely empty (0 bytes) and serve no purpose.
*   **Original Files:**  
    *   Folder Path: [server/src/api/search](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/search)
*   **Step-by-Step Intern Implementation Instructions:**  
    1. Delete the entire folder [server/src/api/search](file:///c:/ongoing_works/codes/Dreamxec/server/src/api/search) from the repository.
    2. Check [server/server.js](file:///c:/ongoing_works/codes/Dreamxec/server/server.js) to confirm no imports or routes point to the search folder.



