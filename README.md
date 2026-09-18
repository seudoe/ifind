# 🚀 iFind Platform

iFind is a powerful, ML-driven internship discovery and recommendation platform. It leverages a **5-tier microservice architecture** to scrape, validate, filter, and recommend the best internships from across the web.

## 🌟 Key Features

### 🔍 1. Intelligent Multi-Source Scraping
- Automatically ingests internship listings from **7+ major platforms** (including GitHub, Internshala, Indeed, Naukri, Unstop, Freshersworld, and Letsintern).
- Implements strict deduplication using SHA-256 fingerprinting based on company name, position, and location.

### 🛡️ 2. ML-Powered Scam Detection & Moderation
- **Automated Scam Engine**: Evaluates company risk, text anomalies, URL safety, and stipend validity.
- **Decision Matrix**: Automatically categorizes incoming listings as `auto_approved`, `pending_review`, or `auto_rejected`.
- **Moderator Portal**: A dedicated secure interface for verified human moderators to manually review flagged listings and oversee platform safety.

### 🧠 3. Advanced Resume Extraction (3-Tier Fallback Strategy)
A robust, highly-available PDF resume parsing pipeline that reliably extracts structured data (skills, education, projects, etc.) using a cascading fallback strategy:
1. **Custom ML Extractor (Primary)**: Uses our proprietary HuggingFace Space (`seudoe/resume-extract`) for offline, zero-token-cost extraction.
2. **OpenAI GPT-4o (Secondary)**: Automatically kicks in as a fallback via the OpenAI API if the HuggingFace endpoint is unavailable.
3. **Google Gemini 2.5 Flash (Tertiary)**: Acts as the final fallback mechanism if OpenAI hits rate limits or quota errors, ensuring users never see a failure.

### 🎯 4. AI Recommender Engine (HNSW Vector Search)
- **Dual-Embedding System**: Combines 15,000-dimensional boosted TF-IDF vectors (for precise keyword/skill matching) with 768-dimensional dense BERT vectors (`all-mpnet-base-v2` for semantic context).
- **HNSW Graph Indexing**: Implements Hierarchical Navigable Small World (HNSW) graphs, with states serialized directly into MongoDB, allowing for lightning-fast k-NN semantic search and highly personalized recommendations based on the user's uploaded resume.

## 💻 Tech Stack

- **Frontend & Recommender Engine**: [Next.js 16](https://nextjs.org/) (Turbopack enabled) and [React 19](https://react.dev/).
- **UI & Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Radix UI primitives.
- **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose) for storing parsed resumes, active internships, user profiles, and binary HNSW graphs.
- **AI Microservices**: Python + FastAPI handling Web Scraping, ML Scam Detection, and Vector Embedding generation.
- **AI Models & APIs**: HuggingFace Transformers, OpenAI API, and Google Gemini API.

## 🚀 Getting Started

First, install the dependencies:
```bash
npm install
```

Configure your environment variables in `.env.local`:
- `MONGODB_URI`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `MOD_JWT_SECRET`
- `MAX_WAIT_FOR_HF` (Optional timeout for resume extractor)

Then, run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
Development is not complete.
