# ChaosLab AI 🚀

### AI-Powered Distributed Systems Failure and Recovery Simulator

**Break it. Observe it. Recover it.**

ChaosLab AI is a web-based distributed systems simulator that lets users trigger service failures, observe dependency-based failure propagation, monitor system health, and receive AI-powered incident analysis and recovery recommendations.

## ✨ Features

- **Service Health Monitoring** — Monitor the health of four interconnected services.
- **Chaos Experiments** — Simulate service shutdowns, high latency, and overload.
- **Dependency Visualization** — Explore relationships between services through an interactive topology.
- **Failure Propagation** — Observe how a failure can affect dependent services.
- **AI Incident Analysis** — Generate root-cause analysis, impact assessments, and recovery recommendations.
- **Recovery and Reset** — Recover services and restore the system.
- **Incident History** — Search and filter incidents by service, severity, and status.
- **Incident Analytics** — Review incident metrics and status summaries.

## 🛠️ Tech Stack

**Frontend:** React, Vite, React Flow, React Markdown  
**Backend:** Python, FastAPI  
**AI Integration:** Groq API  
**Development Tools:** Git, GitHub, npm

## 🏗️ Architecture

The simulation contains four services:

- API Gateway
- User Service
- Payment Service
- Database

The API Gateway depends on the User Service and Payment Service. Both services depend on the Database.

## ⚙️ Run Locally

### Prerequisites

- Python
- Node.js and npm
- A Groq API key for AI-powered analysis

### 1. Clone the repository

```bash
git clone https://github.com/lakshayaramesh-R/ChaosLab-AI.git
cd ChaosLab-AI
```

### 2. Configure the backend

Create and activate a Python virtual environment:

```bash
python -m venv backend/.venv
```

On Windows PowerShell:

```powershell
.\backend\.venv\Scripts\Activate.ps1
```

Install the backend dependencies used by the project:

```powershell
pip install fastapi uvicorn python-dotenv groq
```

Create a `.env` file in the project root and add your own Groq API key:

```env
GROQ_API_KEY=your_groq_api_key
```

**Keep your `.env` file private. Never commit API keys to GitHub.**

Start the backend from the project root:

```powershell
python -m uvicorn backend.main:app --reload
```

Backend URL: `http://127.0.0.1:8000`

### 3. Configure the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite in your terminal.

## 🔐 Security

Store API keys in environment variables. The root `.gitignore` excludes `.env` files and other generated or environment-specific files.

## 🎯 Project Goal

ChaosLab AI demonstrates distributed systems concepts, fault simulation, service dependency analysis, incident management, and integration of a generative AI service into a full-stack web application.

## 👩‍💻 Author

**Lakshaya Ramesh**

[GitHub Repository](https://github.com/lakshayaramesh-R/ChaosLab
