# 📹 Simple LLM + TF-IDF Video Recommender

This is a Flask API that recommends videos to users using:

* ✅ LLM (Cohere) for smart ranking
* 🧠 TF-IDF (text similarity) if LLM fails
* ⏳ Recency sort if both fail

It uses MongoDB to store videos, likes, views, and comments.

---

## 💡 How It Works

1. User sends their `userId` to the API.
2. System finds liked/viewed videos.
3. Gets all other videos as candidates.
4. Tries to rank them using:

   * First: LLM (semantic matching with Cohere)
   * Then: TF-IDF (text similarity)
   * Last: Recency (most recent videos)
5. Returns top video recommendations.

---

## 📦 Requirements

* Python 3.8+
* MongoDB (local or remote)

### 🔧 .env Setup

```
MONGODB_URI=your_mongodb_uri
LLM_API_KEY=your_cohere_api_key
RECOMMENDATION_API_PORT=5000
FLASK_DEBUG=True
```

### 📥 Install

```bash
pip install -r requirements.txt
```

### ▶️ Run

```bash
python app.py
```

---

## 🔌 API: `/recommend`

**POST** JSON:

```json
{
  "userId": "64ae04e5c7c48b2c5a9e2b34",
  "limit": 5
}
```

**Response:**

```json
{
  "recommended": [
    {
      "videoId": "...",
      "caption": "...",
      "author": "...",
      "rank": 1,
      "score": 0.95,
      "method": "llm"
    }
  ],
  "metadata": {
    "user_id": "...",
    "processing_time": 1.2
  }
}
```

---

## 🗃 MongoDB Collections

* `Videos`: video info and captions
* `Likes`, `Views`: user interactions
* `Comments`: up to 3 used per video for context

---

Made with Flask + MongoDB + Cohere + Scikit-learn
