import { PrismaClient, ProjectStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // ⚠️ Replace this with a real donor ID from your DB
    const DEMO_DONOR_ID = "69bc17ef57d38467ab3cd3c5"

    // Optional: Clean previous demo projects
    // 2️⃣ Clean existing demo projects safely
    // await prisma.userProject.deleteMany({
    //     where: {
    //         organization: {
    //             in: [
    //                 "GreenFuture Foundation",
    //                 "EduInfra Initiative",
    //                 "NextGen Talent Fund",
    //                 "Healthcare Innovation Trust",
    //                 "Digital Democracy Lab",
    //                 "AgriTech Impact Fund",
    //                 "Urban Innovation Council",
    //                 "FinTech Youth Fund",
    //                 "Climate Action Alliance",
    //                 "SpaceTech Student Program",
    //                 "Rural Empowerment Trust",
    //                 "EdTech Development Board",
    //                 "CyberSecure India",
    //                 "Mobility Innovation Lab",
    //                 "Women in Tech Grant"
    //             ]
    //         }
    //     }
    // })

    const projects = [
  {
    "title": "Smart Irrigation System 🌱",
    "slug": "smart-irrigation-system",
    "description": "An IoT-based irrigation system that automates watering using soil moisture sensors.",
    "companyName": null,
    "collegeName": {
      "name": "KL University",
      "logo": "https://example.com/klu-logo.png"
    },
    "skillsRequired": ["IoT", "Arduino", "React", "Node.js"],
    "timeline": "3 months",
    "goalAmount": 50000,
    "amountRaised": 12000,
    "imageUrl": "https://example.com/project1.png",
    "campaignMedia": [
      "https://example.com/media1.png",
      "https://example.com/media2.png"
    ],
    "presentationDeckUrl": "https://example.com/deck1.pdf",
    "status": "PENDING",
    "rejectionReason": null,
    "campaignType": "TEAM",
    "teamMembers": [
      {
        "name": "Ravi Teja",
        "role": "Backend Dev",
        "image": "https://example.com/ravi.png"
      },
      {
        "name": "Anjali",
        "role": "Frontend Dev",
        "image": "https://example.com/anjali.png"
      }
    ],
    "faqs": [
      {
        "question": "How does it save water?",
        "answer": "It waters only when moisture drops below threshold."
      }
    ],
    "youtubeUrl": "https://youtube.com/watch?v=abc123",
   "userId":"69bc17ef57d38467ab3cd3c5",
    "rating": 4.5,
    "clubId": "6994a986779861fb1ff44d1e",
    "bankAccountId": null
  },
  {
    "title": "AI Resume Analyzer 🤖",
    "slug": "ai-resume-analyzer",
    "description": "Analyzes resumes and gives ATS score using NLP.",
    "companyName": "ResumeTech",
    "collegeName": null,
    "skillsRequired": ["Python", "NLP", "Machine Learning", "FastAPI"],
    "timeline": "1 month",
    "goalAmount": 20000,
    "amountRaised": 20000,
    "imageUrl": "https://example.com/project2.png",
    "campaignMedia": [],
    "presentationDeckUrl": null,
    "status": "APPROVED",
    "rejectionReason": null,
    "campaignType": "INDIVIDUAL",
    "teamMembers": null,
    "faqs": [
      {
        "question": "Which formats are supported?",
        "answer": "PDF and DOCX."
      }
    ],
    "youtubeUrl": null,
    "userId": "69bc17ef57d38467ab3cd3c5",
    "rating": 4.9,
    "clubId": "6994a986779861fb1ff44d1e",
    "bankAccountId": null
  },
  {
    "title": "Campus Issue Tracker 📢",
    "slug": "campus-issue-tracker",
    "description": "Platform for students to raise and track issues in real-time.",
    "companyName": null,
    "collegeName": {
      "name": "VIT",
      "logo": "https://example.com/vit.png"
    },
    "skillsRequired": ["MERN Stack", "WebSockets"],
    "timeline": "2 months",
    "goalAmount": 30000,
    "amountRaised": 5000,
    "imageUrl": null,
    "campaignMedia": [],
    "presentationDeckUrl": "https://example.com/deck3.pdf",
    "status": "REJECTED",
    "rejectionReason": "Incomplete documentation.",
    "campaignType": "INDIVIDUAL",
    "teamMembers": null,
    "faqs": [],
    "youtubeUrl": null,
    "userId":"69bc17ef57d38467ab3cd3c5",
    "rating": 3.8,
    "clubId": "6994a986779861fb1ff44d1e",
    "bankAccountId": null
  }
]

    for (const project of projects) {
        await prisma.userProject.create({
            data: {
                ...project,
                // donorId: DEMO_DONOR_ID
            }
        })
    }

    console.log("✅ 15 Demo Donor Projects Seeded Successfully")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })