# LLM Finetuning Framework

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

![Terminal Demo](demo.gif)

> **A complete MLOps pipeline for fine-tuning open-source LLMs on custom instruction datasets, complete with evaluation loops.**

## 🌟 Key Features
- ✅ **LoRA/PEFT parameter efficient fine-tuning**
- ✅ **Automated dataset formatting and cleaning**
- ✅ **Comprehensive model evaluation metrics**

## 🏗️ Architecture

```mermaid
flowchart LR
    A[Raw Dataset] --> B(Data Cleaner)
    B --> C[Instruction Formatting]
    C --> D[LoRA/PEFT Training]
    D --> E[Model Weights]
    E --> F[Evaluation Suite]
```

## 🚀 Live API Endpoint (Vercel)

This project is deployed serverless via Vercel Edge Functions. You can test the interaction directly from your terminal.

```bash
# Example Request
curl -X GET https://llm-finetuning-framework-fmh6uvqoj-dev4aibots.vercel.app/api/health
```

## 💻 Developer Quickstart

### Prerequisites
- Python 3.11+
- Node.js (for Vercel CLI)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dev4aibots/llm-finetuning-framework.git
   cd llm-finetuning-framework
   ```

2. **Set up virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Add your API keys to .env
   ```

4. **Run Locally**
   ```bash
   npm run dev
   ```

## 📁 Project Structure
```
.
├── api/                  # Vercel serverless endpoints
├── src/                  # Core Python modules & agent logic
├── tests/                # Unit and integration tests
├── public/               # Static assets
├── requirements.txt      # Python dependencies
└── vercel.json           # Vercel routing configuration
```

## 📄 License
This project is licensed under the MIT License.
