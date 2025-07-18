from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from bson import ObjectId
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import os
import numpy as np
import requests
import json
import time
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)

# MongoDB Config
app.config["MONGO_URI"] = os.environ.get("MONGODB_URI")
mongo = PyMongo(app)

# Hugging Face API Config (free tier)
HF_API_KEY = os.environ.get("HUGGINGFACE_API_KEY")  
HF_API_URL = "https://api-inference.huggingface.co/models/"

class RecommendationEngine:
    def __init__(self):
        self.embedding_cache = {}  # Cache embeddings to save API calls
        self.model_cache = {}  # Cache model responses
        
    def get_hf_embeddings(self, texts, model="sentence-similarity/all-MiniLM-L6-v2"):
        """Get embeddings from Hugging Face Inference API"""
        cache_key = f"{model}:{hash(str(texts))}"
        if cache_key in self.embedding_cache:
            return self.embedding_cache[cache_key]
            
        try:
            headers = {}
            if HF_API_KEY:
                headers["Authorization"] = f"Bearer {HF_API_KEY}"
            
            # Ensure texts is a list
            if isinstance(texts, str):
                texts = [texts]
            
            response = requests.post(
                f"{HF_API_URL}{model}",
                headers=headers,
                json={"inputs": texts, "options": {"wait_for_model": True}},
                timeout=30
            )
            
            if response.status_code == 503:
                # Model is loading, wait and retry
                print("Model loading, waiting...")
                time.sleep(10)
                response = requests.post(
                    f"{HF_API_URL}{model}",
                    headers=headers,
                    json={"inputs": texts, "options": {"wait_for_model": True}},
                    timeout=30
                )
            
            if response.status_code == 200:
                embeddings = response.json()
                self.embedding_cache[cache_key] = embeddings
                return embeddings
            else:
                print(f"HF API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"HF embedding error: {e}")
            return None
    
    def get_llm_analysis(self, liked_captions, candidate_captions):
        """Use free LLM for similarity analysis"""
        try:
            # Use a free text generation model
            model = "microsoft/DialoGPT-medium"  # Alternative: "gpt2", "distilgpt2"
            
            # Create a simple prompt
            prompt = f"""Analyze video similarity. User likes: {', '.join(liked_captions[:3])}. 
Rate these videos 0-10: {', '.join(candidate_captions[:5])}. 
Scores:"""
            
            headers = {}
            if HF_API_KEY:
                headers["Authorization"] = f"Bearer {HF_API_KEY}"
            
            response = requests.post(
                f"{HF_API_URL}{model}",
                headers=headers,
                json={
                    "inputs": prompt,
                    "parameters": {
                        "max_length": 100,
                        "temperature": 0.3,
                        "return_full_text": False
                    },
                    "options": {"wait_for_model": True}
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result[0]["generated_text"] if result else None
            else:
                print(f"LLM analysis error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"LLM analysis error: {e}")
            return None
    
    def get_semantic_similarity_scores(self, liked_texts, candidate_texts):
        """Use sentence similarity pipeline with correct input format."""
        try:
            model = "sentence-transformers/all-MiniLM-L6-v2"  # or your preferred model
            headers = {}
            if HF_API_KEY:
                headers["Authorization"] = f"Bearer {HF_API_KEY}"

            all_scores = []
            for liked in liked_texts:
                payload = {
                    "inputs": {
                        "source_sentence": liked,
                        "sentences": candidate_texts
                    },
                    "options": {"wait_for_model": True}
                }
                response = requests.post(
                    f"{HF_API_URL}{model}",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                if response.status_code == 200:
                    scores = response.json()
                    all_scores.append(scores)
                else:
                    print(f"HF API error: {response.status_code} - {response.text}")
                    return None
                time.sleep(0.1)  # avoid rate limiting

            # Average the scores for each candidate across all liked texts
            if all_scores:
                avg_scores = np.mean(all_scores, axis=0)
                return avg_scores.tolist()
            else:
                return None

        except Exception as e:
            print(f"Semantic similarity error: {e}")
            return None

# Initialize recommendation engine
rec_engine = RecommendationEngine()

@app.route('/recommend', methods=["POST"])
def recommend():
    try:
        data = request.get_json()
        user_id = data.get("userId")
        method = data.get("method", "hybrid")  # hybrid, llm, tfidf, semantic
        
        if not user_id:
            return jsonify({"error": "userId is required"}), 400

        print(f"Getting recommendations for user: {user_id} using method: {method}")

        # Get user interactions
        liked_cursor = mongo.db.Likes.find({"userId": ObjectId(user_id)})
        liked_video_ids = [doc["videoId"] for doc in liked_cursor]
        
        viewed_cursor = mongo.db.Views.find({"userId": ObjectId(user_id)})
        viewed_video_ids = [doc["videoId"] for doc in viewed_cursor]
        
        interacted_video_ids = set(liked_video_ids + viewed_video_ids)

        # Get all videos
        videos_cursor = mongo.db.Videos.find({})
        videos = []
        liked_videos = []
        
        for video in videos_cursor:
            video_id = video["_id"]
            caption = video.get("caption", "")
            
            # Get comments
            comments_cursor = mongo.db.Comments.find({"videoId": video_id})
            comments_texts = [c.get("text", "") for c in comments_cursor]
            combined_text = caption + " " + " ".join(comments_texts)
            
            video_data = {
                "id": str(video_id),
                "video_id_obj": video_id,
                "caption": caption,
                "combined_text": combined_text.strip() or "no content",
                "created_at": video.get("createdAt", "")
            }
            
            videos.append(video_data)
            
            if video_id in liked_video_ids:
                liked_videos.append(video_data)

        if not videos:
            return jsonify({"recommended": []})

        if not liked_videos:
            return fallback_recent_videos(videos, interacted_video_ids)

        # Filter videos available for recommendation
        candidate_videos = [v for v in videos if v["video_id_obj"] not in interacted_video_ids]
        
        if not candidate_videos:
            return jsonify({"recommended": []})

        print(f"Found {len(liked_videos)} liked videos, {len(candidate_videos)} candidates")

        # Choose recommendation method
        if method == "embeddings":
            recommendations = get_embedding_recommendations(liked_videos, candidate_videos)
        elif method == "semantic":
            recommendations = get_semantic_recommendations(liked_videos, candidate_videos)
        elif method == "tfidf":
            recommendations = get_tfidf_recommendations(liked_videos, candidate_videos)
        else:  # hybrid
            recommendations = get_hybrid_recommendations(liked_videos, candidate_videos)

        return jsonify({"recommended": recommendations})

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

def get_embedding_recommendations(liked_videos, candidate_videos):
    """Use Hugging Face embeddings for recommendations"""
    print("Using HF embedding recommendations")
    
    liked_captions = [v["combined_text"] for v in liked_videos]
    candidate_captions = [v["combined_text"] for v in candidate_videos]
    
    # Get embeddings for all videos
    all_captions = liked_captions + candidate_captions
    
    # Use a good sentence transformer model
    embeddings = rec_engine.get_hf_embeddings(all_captions, "sentence-transformers/all-MiniLM-L6-v2")
    
    if embeddings and len(embeddings) == len(all_captions):
        # Split embeddings
        liked_embeddings = embeddings[:len(liked_captions)]
        candidate_embeddings = embeddings[len(liked_captions):]
        
        # Convert to numpy arrays
        liked_embeddings = np.array(liked_embeddings)
        candidate_embeddings = np.array(candidate_embeddings)
        
        # Create user profile as average of liked video embeddings
        user_profile = np.mean(liked_embeddings, axis=0)
        
        # Calculate cosine similarities
        similarities = []
        for candidate_emb in candidate_embeddings:
            similarity = np.dot(user_profile, candidate_emb) / (
                np.linalg.norm(user_profile) * np.linalg.norm(candidate_emb)
            )
            similarities.append(similarity)
        
        # Attach scores and sort
        for i, video in enumerate(candidate_videos):
            video["similarity"] = similarities[i]
            
        candidate_videos.sort(key=lambda x: x["similarity"], reverse=True)
        
        print("Top 5 embedding similarities:")
        for i, v in enumerate(candidate_videos[:5]):
            print(f"  {i+1}. {v['similarity']:.4f} - {v['caption']}")
        
        recommendations = [{
            "videoId": v["id"],
            "caption": v["caption"],
            "score": round(float(v["similarity"]), 4),
            "method": "hf_embeddings"
        } for v in candidate_videos[:5]]
        
        return recommendations
    
    # Fallback to TF-IDF if embeddings fail
    print("HF embeddings failed, falling back to TF-IDF")
    return get_tfidf_recommendations(liked_videos, candidate_videos)

def get_semantic_recommendations(liked_videos, candidate_videos):
    """Use cross-encoder for semantic similarity"""
    print("Using semantic similarity recommendations")
    
    # Limit to prevent too many API calls
    if len(candidate_videos) > 10:
        candidate_videos = candidate_videos[:10]
    
    liked_texts = [v["combined_text"] for v in liked_videos]
    candidate_texts = [v["combined_text"] for v in candidate_videos]
    
    similarity_scores = rec_engine.get_semantic_similarity_scores(liked_texts, candidate_texts)
    
    if similarity_scores and len(similarity_scores) == len(candidate_videos):
        # Attach scores and sort
        for i, video in enumerate(candidate_videos):
            video["similarity"] = similarity_scores[i]
            
        candidate_videos.sort(key=lambda x: x["similarity"], reverse=True)
        
        print("Top 5 semantic similarities:")
        for i, v in enumerate(candidate_videos[:5]):
            print(f"  {i+1}. {v['similarity']:.4f} - {v['caption']}")
        
        recommendations = [{
            "videoId": v["id"],
            "caption": v["caption"],
            "score": round(float(v["similarity"]), 4),
            "method": "semantic_similarity"
        } for v in candidate_videos[:5]]
        
        return recommendations
    
    # Fallback to embeddings
    print("Semantic similarity failed, falling back to embeddings")
    return get_embedding_recommendations(liked_videos, candidate_videos)

def get_tfidf_recommendations(liked_videos, candidate_videos):
    """Use TF-IDF for recommendations"""
    print("Using TF-IDF recommendations")
    
    all_videos = liked_videos + candidate_videos
    all_texts = [v["combined_text"] for v in all_videos]
    
    tfidf = TfidfVectorizer(
        stop_words="english",
        max_features=1000,
        min_df=1,
        max_df=0.9,
        ngram_range=(1, 2)
    )
    
    tfidf_matrix = tfidf.fit_transform(all_texts)
    
    # Get user profile from liked videos
    liked_indices = list(range(len(liked_videos)))
    liked_vectors = tfidf_matrix[liked_indices]
    user_profile = np.asarray(liked_vectors.mean(axis=0)).flatten()
    
    # Calculate similarities for candidate videos
    candidate_indices = list(range(len(liked_videos), len(all_videos)))
    candidate_vectors = tfidf_matrix[candidate_indices]
    similarities = cosine_similarity([user_profile], candidate_vectors).flatten()
    
    # Attach scores and sort
    for i, video in enumerate(candidate_videos):
        video["similarity"] = similarities[i]
        
    candidate_videos.sort(key=lambda x: x["similarity"], reverse=True)
    
    print("Top 5 TF-IDF similarities:")
    for i, v in enumerate(candidate_videos[:5]):
        print(f"  {i+1}. {v['similarity']:.4f} - {v['caption']}")
    
    recommendations = [{
        "videoId": v["id"],
        "caption": v["caption"],
        "score": round(float(v["similarity"]), 4),
        "method": "tfidf"
    } for v in candidate_videos[:5]]
    
    return recommendations

def get_hybrid_recommendations(liked_videos, candidate_videos):
    """Combine embeddings and TF-IDF recommendations"""
    print("Using hybrid recommendations")
    
    try:
        # Get both types of recommendations
        embedding_recs = get_embedding_recommendations(liked_videos.copy(), candidate_videos.copy())
        tfidf_recs = get_tfidf_recommendations(liked_videos.copy(), candidate_videos.copy())
        
        # Create combined score (80% embeddings, 20% TF-IDF)
        embedding_scores = {rec["videoId"]: rec["score"] for rec in embedding_recs}
        tfidf_scores = {rec["videoId"]: rec["score"] for rec in tfidf_recs}
        
        combined_recommendations = []
        for video in candidate_videos:
            embedding_score = embedding_scores.get(video["id"], 0.0)
            tfidf_score = tfidf_scores.get(video["id"], 0.0)
            
            # Weighted combination (favor embeddings more)
            combined_score = 0.8 * embedding_score + 0.2 * tfidf_score
            
            combined_recommendations.append({
                "videoId": video["id"],
                "caption": video["caption"],
                "score": round(combined_score, 4),
                "embedding_score": round(embedding_score, 4),
                "tfidf_score": round(tfidf_score, 4),
                "method": "hybrid"
            })
        
        # Sort by combined score
        combined_recommendations.sort(key=lambda x: x["score"], reverse=True)
        
        print("Top 5 hybrid recommendations:")
        for i, rec in enumerate(combined_recommendations[:5]):
            print(f"  {i+1}. {rec['score']:.4f} (E:{rec['embedding_score']:.4f}, T:{rec['tfidf_score']:.4f}) - {rec['caption']}")
        
        return combined_recommendations[:5]
        
    except Exception as e:
        print(f"Hybrid failed: {e}, falling back to TF-IDF")
        return get_tfidf_recommendations(liked_videos, candidate_videos)

def fallback_recent_videos(videos, interacted_video_ids):
    """Fallback to most recent videos"""
    print("Using fallback: recent videos")
    available_videos = [v for v in videos if v["video_id_obj"] not in interacted_video_ids]
    available_videos.sort(key=lambda x: x["created_at"], reverse=True)
    
    recommendations = [{
        "videoId": v["id"],
        "caption": v["caption"],
        "score": 0.0,
        "method": "fallback_recent"
    } for v in available_videos[:5]]
    
    return recommendations

@app.route('/compare', methods=["POST"])
def compare_methods():
    """Compare different recommendation methods"""
    try:
        data = request.get_json()
        user_id = data.get("userId")
        
        if not user_id:
            return jsonify({"error": "userId is required"}), 400
        
        methods = ["embeddings", "tfidf", "hybrid"]
        results = {}
        
        for method in methods:
            try:
                # Make request to own endpoint
                response = requests.post(
                    f"http://localhost:{os.environ.get('RECOMMENDATION_API_PORT', 5000)}/recommend",
                    json={"userId": user_id, "method": method},
                    timeout=30
                )
                if response.status_code == 200:
                    results[method] = response.json()["recommended"]
                else:
                    results[method] = {"error": f"Status {response.status_code}"}
            except Exception as e:
                results[method] = {"error": str(e)}
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("RECOMMENDATION_API_PORT", 5000))
    app.run(debug=True, port=port)
