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

load_dotenv()

# Configure logging
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

# Hugging Face API Config
HF_API_KEY = os.environ.get("HUGGINGFACE_API_KEY")
if not HF_API_KEY:
    logger.warning("HUGGINGFACE_API_KEY not found - will use fallback methods")

HF_API_URL = "https://api-inference.huggingface.co/models/"

class LLMVideoRecommender:
    def __init__(self):
        self.api_key = HF_API_KEY
        self.model_name = "microsoft/DialoGPT-medium"  # Simple text generation model
        self.max_retries = 3
        self.retry_delay = 2
        
    def call_llm_api(self, prompt, max_length=200):
        """Call Hugging Face LLM API with error handling and retries"""
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_length": max_length,
                "temperature": 0.7,
                "return_full_text": False,
                "do_sample": True
            },
            "options": {"wait_for_model": True}
        }
        
        for attempt in range(self.max_retries):
            try:
                logger.info(f"LLM API call attempt {attempt + 1}/{self.max_retries}")
                
                response = requests.post(
                    f"{HF_API_URL}{self.model_name}",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
                logger.info(f"API Response Status: {response.status_code}")
                
                if response.status_code == 503:
                    logger.warning(f"Model loading, waiting {self.retry_delay} seconds...")
                    time.sleep(self.retry_delay)
                    continue
                    
                if response.status_code == 200:
                    result = response.json()
                    logger.info("LLM API call successful")
                    return result
                else:
                    logger.error(f"API Error {response.status_code}: {response.text}")
                    
            except requests.exceptions.Timeout:
                logger.error(f"API timeout on attempt {attempt + 1}")
            except requests.exceptions.RequestException as e:
                logger.error(f"API request error on attempt {attempt + 1}: {e}")
            except Exception as e:
                logger.error(f"Unexpected error on attempt {attempt + 1}: {e}")
                
            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (attempt + 1))
        
        logger.error("All LLM API attempts failed")
        return None
    
    def rank_videos_with_llm(self, user_preferences, candidate_videos):
        """Use LLM to rank videos based on user preferences"""
        try:
            if not candidate_videos:
                logger.warning("No candidate videos to rank")
                return []
            
            # Prepare user preference summary
            preference_text = self._summarize_preferences(user_preferences)
            
            # Limit candidates to avoid token limits
            limited_candidates = candidate_videos[:10]
            
            # Create video summaries
            video_summaries = []
            for i, video in enumerate(limited_candidates):
                summary = f"{i+1}. {video.get('caption', 'No caption')[:100]}..."
                video_summaries.append(summary)
            
            # Create ranking prompt
            prompt = self._create_ranking_prompt(preference_text, video_summaries)
            
            # Call LLM
            llm_response = self.call_llm_api(prompt)
            
            if not llm_response:
                logger.warning("LLM ranking failed, using fallback")
                return self._fallback_ranking(limited_candidates)
            
            # Parse LLM response and rank videos
            rankings = self._parse_ranking_response(llm_response, limited_candidates)
            
            logger.info(f"Successfully ranked {len(rankings)} videos")
            return rankings
            
        except Exception as e:
            logger.error(f"Error in LLM ranking: {e}")
            return self._fallback_ranking(candidate_videos[:5])
    
    def _summarize_preferences(self, user_preferences):
        """Create a summary of user preferences from liked videos"""
        try:
            if not user_preferences:
                return "No specific preferences available"
            
            captions = []
            for pref in user_preferences[:5]:  # Limit to avoid token overflow
                caption = pref.get('caption', '').strip()
                if caption:
                    captions.append(caption)
            
            if not captions:
                return "User has liked videos but no clear content patterns"
            
            # Simple concatenation with truncation
            combined = " | ".join(captions)
            return combined[:500] + "..." if len(combined) > 500 else combined
            
        except Exception as e:
            logger.error(f"Error summarizing preferences: {e}")
            return "Error processing user preferences"
    
    def _create_ranking_prompt(self, preferences, video_summaries):
        """Create a prompt for the LLM to rank videos"""
        prompt = f"""Based on a user who likes videos about: {preferences}

Please rank these videos from most relevant (1) to least relevant ({len(video_summaries)}):

{chr(10).join(video_summaries)}

Ranking (just numbers separated by commas, most relevant first):"""
        
        logger.info(f"Created ranking prompt with {len(video_summaries)} videos")
        return prompt
    
    def _parse_ranking_response(self, llm_response, candidate_videos):
        """Parse LLM response to extract video rankings"""
        try:
            # Extract response text
            response_text = ""
            if isinstance(llm_response, list) and llm_response:
                response_text = llm_response[0].get('generated_text', '')
            elif isinstance(llm_response, dict):
                response_text = llm_response.get('generated_text', '')
            
            logger.info(f"LLM response: {response_text}")
            
            if not response_text:
                logger.warning("Empty LLM response")
                return self._fallback_ranking(candidate_videos)
            
            # Extract numbers from response
            import re
            numbers = re.findall(r'\b\d+\b', response_text)
            
            if not numbers:
                logger.warning("No ranking numbers found in LLM response")
                return self._fallback_ranking(candidate_videos)
            
            # Create ranked list
            ranked_videos = []
            used_indices = set()
            
            for num_str in numbers:
                try:
                    idx = int(num_str) - 1  # Convert to 0-based index
                    if 0 <= idx < len(candidate_videos) and idx not in used_indices:
                        video = candidate_videos[idx].copy()
                        video['llm_rank'] = len(ranked_videos) + 1
                        video['llm_score'] = 1.0 - (len(ranked_videos) / len(candidate_videos))
                        ranked_videos.append(video)
                        used_indices.add(idx)
                except ValueError:
                    continue
            
            # Add any remaining videos
            for i, video in enumerate(candidate_videos):
                if i not in used_indices:
                    video_copy = video.copy()
                    video_copy['llm_rank'] = len(ranked_videos) + 1
                    video_copy['llm_score'] = 0.1
                    ranked_videos.append(video_copy)
            
            logger.info(f"Parsed {len(ranked_videos)} ranked videos from LLM response")
            return ranked_videos
            
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            return self._fallback_ranking(candidate_videos)
    
    def _fallback_ranking(self, candidate_videos):
        """Simple fallback ranking based on recency"""
        try:
            logger.info("Using fallback ranking")
            
            sorted_videos = sorted(
                candidate_videos,
                key=lambda x: x.get('created_at', ''),
                reverse=True
            )
            
            for i, video in enumerate(sorted_videos):
                video['llm_rank'] = i + 1
                video['llm_score'] = 1.0 - (i / len(sorted_videos))
                video['ranking_method'] = 'fallback_recent'
            
            return sorted_videos[:5]
            
        except Exception as e:
            logger.error(f"Error in fallback ranking: {e}")
            return candidate_videos[:5]

# Initialize recommender
recommender = LLMVideoRecommender()



@app.route('/recommend', methods=["POST"])
def recommend():
    """Get video recommendations for a user"""
    start_time = time.time()
    
    try:
        # Parse request
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        user_id = data.get("userId")
        limit = min(data.get("limit", 5), 20)  # Cap at 20
        
        if not user_id:
            return jsonify({"error": "userId is required"}), 400
        
        logger.info(f"Getting recommendations for user: {user_id} (limit: {limit})")
        
        # Validate user ID format
        try:
            user_object_id = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Invalid userId format"}), 400
        
        # Get user interactions
        try:
            liked_cursor = mongo.db.Likes.find({"userId": user_object_id})
            liked_video_ids = [doc["videoId"] for doc in liked_cursor]
            
            viewed_cursor = mongo.db.Views.find({"userId": user_object_id})
            viewed_video_ids = [doc["videoId"] for doc in viewed_cursor]
            
            interacted_video_ids = set(liked_video_ids + viewed_video_ids)
            
            logger.info(f"User has {len(liked_video_ids)} likes, {len(viewed_video_ids)} views")
            
        except Exception as e:
            logger.error(f"Error fetching user interactions: {e}")
            return jsonify({"error": "Failed to fetch user interactions"}), 500
        
        # Get all videos
        try:
            videos_cursor = mongo.db.Videos.find({})
            videos = []
            liked_videos = []
            
            for video in videos_cursor:
                video_id = video["_id"]
                caption = video.get("caption", "")
                
                # Get comments for context
                try:
                    comments_cursor = mongo.db.Comments.find({"videoId": video_id})
                    comments_texts = [c.get("text", "") for c in comments_cursor if c.get("text")]
                    comments_summary = " ".join(comments_texts[:3])  # Limit comments
                except Exception as e:
                    logger.warning(f"Error fetching comments for video {video_id}: {e}")
                    comments_summary = ""
                
                video_data = {
                    "id": str(video_id),
                    "video_id_obj": video_id,
                    "caption": caption,
                    "comments_summary": comments_summary,
                    "created_at": video.get("createdAt", ""),
                    "author": video.get("author", "")
                }
                
                videos.append(video_data)
                
                if video_id in liked_video_ids:
                    liked_videos.append(video_data)
            
            logger.info(f"Found {len(videos)} total videos, {len(liked_videos)} liked videos")
            
        except Exception as e:
            logger.error(f"Error fetching videos: {e}")
            return jsonify({"error": "Failed to fetch videos"}), 500
        
        if not videos:
            logger.warning("No videos found in database")
            return jsonify({"recommended": []})
        
        # Filter candidate videos
        candidate_videos = [v for v in videos if v["video_id_obj"] not in interacted_video_ids]
        
        if not candidate_videos:
            logger.info("No new videos available for recommendation")
            return jsonify({"recommended": []})
        
        logger.info(f"Found {len(candidate_videos)} candidate videos")
        
        # Get LLM-based recommendations
        try:
            recommendations = recommender.rank_videos_with_llm(liked_videos, candidate_videos)
            
            # Format response
            formatted_recommendations = []
            for i, video in enumerate(recommendations[:limit]):
                formatted_recommendations.append({
                    "videoId": video["id"],
                    "caption": video["caption"],
                    "author": video.get("author", ""),
                    "rank": video.get("llm_rank", i + 1),
                    "score": video.get("llm_score", 0.0),
                    "method": "llm_ranking",
                    "ranking_method": video.get("ranking_method", "llm")
                })
            
            processing_time = time.time() - start_time
            logger.info(f"Successfully generated {len(formatted_recommendations)} recommendations in {processing_time:.2f}s")
            
            return jsonify({
                "recommended": formatted_recommendations,
                "metadata": {
                    "user_id": user_id,
                    "processing_time": round(processing_time, 2),
                    "total_candidates": len(candidate_videos),
                    "user_liked_count": len(liked_videos),
                    "method": "llm_ranking"
                }
            })
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return jsonify({"error": "Failed to generate recommendations"}), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in recommend endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500



@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    try:
        port = int(os.environ.get("RECOMMENDATION_API_PORT", 5000))
        debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
        
        logger.info(f"Starting recommendation API on port {port}")
        logger.info(f"Debug mode: {debug_mode}")
        logger.info(f"LLM API configured: {bool(HF_API_KEY)}")
        
        app.run(debug=debug_mode, port=port, host='0.0.0.0')
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise