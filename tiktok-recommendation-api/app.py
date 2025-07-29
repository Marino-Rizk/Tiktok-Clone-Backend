from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from bson import ObjectId
import os
import requests
import json
import time
import logging
from datetime import datetime
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re

load_dotenv()

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('recommendation_api.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# MongoDB Config
try:
    app.config["MONGO_URI"] = os.environ.get("MONGODB_URI")
    if not app.config["MONGO_URI"]:
        raise ValueError("MONGODB_URI environment variable is required")
    mongo = PyMongo(app)
    logger.info("MongoDB connection initialized")
except Exception as e:
    logger.error(f"MongoDB initialization failed: {e}")
    raise

# Cohere API
LLM_API_KEY = os.environ.get("LLM_API_KEY")
if not LLM_API_KEY:
    logger.warning("LLM_API_KEY not found - will use fallback methods")

COHERE_API_URL = "https://api.cohere.ai/v1/generate"

class LLMVideoRecommender:
    def __init__(self):
        self.api_key = LLM_API_KEY
        self.max_retries = 3
        self.retry_delay = 2

    def call_llm_api(self, prompt, max_tokens=200):
        if not self.api_key:
            logger.warning("No API key available for LLM")
            return None

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "command",
            "prompt": prompt,
            "max_tokens": max_tokens,
            "temperature": 0.7,
            "stop_sequences": ["\n"]
        }

        for attempt in range(self.max_retries):
            try:
                logger.info(f"LLM API call attempt {attempt + 1}/{self.max_retries}")
                response = requests.post(COHERE_API_URL, headers=headers, json=payload, timeout=30)

                if response.status_code == 200:
                    result = response.json()
                    if "generations" in result and result["generations"]:
                        return result["generations"][0]["text"].strip()
                elif response.status_code == 429:
                    logger.warning("Rate limit hit, waiting longer")
                    time.sleep(self.retry_delay * (attempt + 2))
                else:
                    logger.error(f"API Error {response.status_code}: {response.text}")
            except Exception as e:
                logger.error(f"LLM call failed: {e}")
                time.sleep(self.retry_delay * (attempt + 1))
        return None

    def rank_videos_with_llm(self, user_preferences, candidate_videos):
        try:
            if not candidate_videos:
                return []

            preference_text = self._summarize_preferences(user_preferences)
            limited_candidates = candidate_videos[:10]

            video_summaries = [f"{i+1}. {v.get('caption', '')[:100]}..." for i, v in enumerate(limited_candidates)]
            prompt = self._create_ranking_prompt(preference_text, video_summaries)

            llm_response = self.call_llm_api(prompt, max_tokens=100)

            if llm_response:
                return self._parse_ranking_response(llm_response, limited_candidates)

            logger.warning("LLM failed - falling back to TF-IDF")
            return self._tfidf_ranking(candidate_videos, user_preferences)

        except Exception as e:
            logger.error(f"LLM ranking error: {e}")
            return self._tfidf_ranking(candidate_videos, user_preferences)

    def _summarize_preferences(self, user_preferences):
        captions = [v.get('caption', '').strip() for v in user_preferences[:5] if v.get('caption')]
        combined = " | ".join(captions)
        return combined[:400] + "..." if len(combined) > 400 else combined

    def _create_ranking_prompt(self, preferences, video_summaries):
        return f"""Based on a user who likes: {preferences}
Rank these videos from 1 (most relevant) to {len(video_summaries)} (least relevant):
{chr(10).join(video_summaries)}
Ranking (numbers only, comma-separated):"""

    def _parse_ranking_response(self, response, candidate_videos):
        try:
            numbers = re.findall(r'\b\d+\b', response)
            ranked_videos = []
            used = set()

            for rank, num in enumerate(numbers):
                idx = int(num) - 1
                if 0 <= idx < len(candidate_videos) and idx not in used:
                    v = candidate_videos[idx].copy()
                    v["llm_rank"] = rank + 1
                    v["llm_score"] = 1.0 - (rank / len(candidate_videos))
                    v["ranking_method"] = "llm"
                    ranked_videos.append(v)
                    used.add(idx)

            for i, v in enumerate(candidate_videos):
                if i not in used:
                    v_copy = v.copy()
                    v_copy["llm_rank"] = len(ranked_videos) + 1
                    v_copy["llm_score"] = 0.1
                    v_copy["ranking_method"] = "llm_unranked"
                    ranked_videos.append(v_copy)

            return ranked_videos
        except Exception as e:
            logger.error(f"Parse LLM ranking error: {e}")
            return self._tfidf_ranking(candidate_videos, [])

    def _tfidf_ranking(self, candidate_videos, liked_videos):
        try:
            liked_captions = [v.get("caption", "") for v in liked_videos if v.get("caption")]
            candidate_captions = [v.get("caption", "") for v in candidate_videos if v.get("caption")]

            if not liked_captions or not candidate_captions:
                return self._simple_fallback(candidate_videos)

            tfidf = TfidfVectorizer(stop_words="english")
            all_text = liked_captions + candidate_captions
            matrix = tfidf.fit_transform(all_text)

            liked_vec = np.mean(matrix[:len(liked_captions)].toarray(), axis=0).reshape(1, -1)
            candidate_vecs = matrix[len(liked_captions):]

            sims = cosine_similarity(liked_vec, candidate_vecs).flatten()

            for i, (v, score) in enumerate(zip(candidate_videos, sims)):
                v["llm_score"] = float(score)
                v["ranking_method"] = "hybrid_tfidf"

            return sorted(candidate_videos, key=lambda x: x["llm_score"], reverse=True)[:5]

        except Exception as e:
            logger.error(f"TF-IDF fallback failed: {e}")
            return self._simple_fallback(candidate_videos)

    def _simple_fallback(self, videos):
        logger.warning("Using simple fallback (recency)")
        try:
            videos_sorted = sorted(
                videos, key=lambda x: x.get("created_at", ""), reverse=True
            )
            for i, v in enumerate(videos_sorted):
                v["llm_score"] = 1.0 - i / len(videos_sorted)
                v["ranking_method"] = "fallback_recent"
            return videos_sorted[:5]
        except Exception as e:
            logger.error(f"Simple fallback failed: {e}")
            return videos[:5]

recommender = LLMVideoRecommender()

@app.route('/recommend', methods=['POST'])
def recommend():
    start_time = time.time()
    try:
        data = request.get_json()
        user_id = data.get("userId")
        limit = min(data.get("limit", 5), 20)
        user_object_id = ObjectId(user_id)

        likes = mongo.db.Likes.find({"userId": user_object_id})
        views = mongo.db.Views.find({"userId": user_object_id})

        liked_ids = [d["videoId"] for d in likes if "videoId" in d]
        viewed_ids = [d["videoId"] for d in views if "videoId" in d]
        interacted_ids = set(liked_ids + viewed_ids)

        videos = []
        liked_videos = []

        for v in mongo.db.Videos.find({}).limit(1000):
            try:
                video_id = v["_id"]
                caption = v.get("caption", "")
                comments = mongo.db.Comments.find({"videoId": video_id}).limit(3)
                comments_summary = " ".join([c.get("text", "").strip() for c in comments])

                vid_data = {
                    "id": str(video_id),
                    "video_id_obj": video_id,
                    "caption": caption,
                    "comments_summary": comments_summary[:200],
                    "created_at": v.get("createdAt", ""),
                    "author": v.get("author", "")
                }

                if video_id in liked_ids:
                    liked_videos.append(vid_data)

                videos.append(vid_data)
            except Exception as e:
                logger.warning(f"Error processing video: {e}")

        candidates = [v for v in videos if v["video_id_obj"] not in interacted_ids]

        recommendations = recommender.rank_videos_with_llm(liked_videos, candidates)

        response = [{
            "videoId": v["id"],
            "caption": v["caption"],
            "author": v.get("author", ""),
            "rank": v.get("llm_rank", i + 1),
            "score": v.get("llm_score", 0.0),
            "method": v.get("ranking_method", "unknown")
        } for i, v in enumerate(recommendations[:limit])]

        return jsonify({
            "recommended": response,
            "metadata": {
                "user_id": user_id,
                "processing_time": round(time.time() - start_time, 2),
                "total_candidates": len(candidates),
                "user_liked_count": len(liked_videos)
            }
        })

    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    try:
        port = int(os.environ.get("RECOMMENDATION_API_PORT", 5000))
        debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
        app.run(debug=debug_mode, port=port, host='0.0.0.0')
    except Exception as e:
        logger.error(f"Startup error: {e}")
