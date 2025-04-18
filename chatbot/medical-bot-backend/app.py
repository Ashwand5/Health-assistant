from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from dotenv import load_dotenv
from paddleocr import PaddleOCR
import PyPDF2
import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from functools import wraps
from bson import ObjectId
import certifi
import logging
import time
from weaviate import Client
import weaviate.auth
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import Weaviate
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate
from langchain.schema import Document
from process_admin_pdf import process_admin_pdf
import numpy as np
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import google.generativeai as genai
import re
from tensorflow.keras.layers import TFSMLayer
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logger.error("GOOGLE_API_KEY is not set in the environment variables.")
    exit(1)
logger.debug(f"GOOGLE_API_KEY loaded: {GOOGLE_API_KEY}")

WEAVIATE_URL = os.getenv("WEAVIATE_URL")
WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")

app = Flask(__name__)

# Initialize OCR globally (run once)
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)

# CORS configuration
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:3000")
CORS(app, resources={r"/api/*": {"origins": CORS_ORIGIN}}, supports_credentials=True)

# MongoDB connection with retry
mongo_uri = os.getenv("MONGO_URI")
max_retries = 3
retry_delay = 5  # seconds
client = None

for attempt in range(max_retries):
    try:
        logger.debug("Attempting to connect to MongoDB (attempt %d/%d)...", attempt + 1, max_retries)
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            tls=True,
            tlsCAFile=certifi.where(),
            tlsAllowInvalidCertificates=False
        )
        client.admin.command('ping')
        db = client["medical-bot"]
        users_collection = db["users"]
        logger.info("Connected to MongoDB successfully!")
        break
    except ConnectionFailure as e:
        logger.error(f"Failed to connect to MongoDB (attempt %d/%d): %s", attempt + 1, max_retries, e)
        if attempt < max_retries - 1:
            logger.info(f"Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)
        else:
            logger.error("Max retries reached. Exiting...")
            exit(1)
    except Exception as e:
        logger.error(f"Error setting up MongoDB connection: %s", e)
        exit(1)

# Secret key for JWT
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    logger.error("Error: SECRET_KEY is not set in the environment variables.")
    exit(1)

app.config['JWT_SECRET_KEY'] = SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)

# Initialize Weaviate Client
try:
    if WEAVIATE_URL and WEAVIATE_API_KEY:
        weaviate_client = Client(
            url=WEAVIATE_URL,
            auth_client_secret=weaviate.auth.AuthApiKey(api_key=WEAVIATE_API_KEY),
            timeout_config=(10, 60)  # 10s connection, 60s read
        )
        weaviate_client.get_meta()
        logger.info("Successfully connected to Weaviate Cloud")
    else:
        logger.warning("Weaviate URL or API key not provided, skipping Weaviate initialization")
        weaviate_client = None
except Exception as e:
    logger.error(f"Failed to initialize Weaviate client: {str(e)}")
    weaviate_client = None

# Initialize Embedding Model
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
genai.configure(api_key=GOOGLE_API_KEY)

# Create Weaviate schemas on startup
def create_weaviate_schemas():
    collections = ["Admin", "food_analyse"]
    for collection in collections:
        schema = {
            "class": collection,
            "vectorizer": "none",
            "properties": [
                {"name": "text", "dataType": ["text"]}
            ]
        }
        if weaviate_client and not weaviate_client.schema.exists(collection):
            try:
                weaviate_client.schema.create_class(schema)
                logger.info(f"Created Weaviate class: {collection}")
                # Add default food data if food_analyse is newly created
                if collection == "food_analyse" and not weaviate_client.query.aggregate(collection).with_meta_count().do().get("data", {}).get("Aggregate", {}).get(collection, [{}])[0].get("meta", {}).get("count", 0):
                    default_data = [
                        {"text": "Biryani: Spiced rice dish, high in carbs, suitable with vegetables."},
                        {"text": "Poha: Light flattened rice dish, good for breakfast."}
                    ]
                    with weaviate_client.batch as batch:
                        for data in default_data:
                            batch.add_data_object(
                                data_object=data,
                                class_name=collection,
                                vector=embeddings.embed_documents([data["text"]])[0]
                            )
                    logger.info(f"Added default data to {collection}")
            except Exception as e:
                logger.error(f"Failed to create Weaviate class {collection}: {str(e)}")
        else:
            logger.info(f"Class {collection} already exists or Weaviate client is None")

create_weaviate_schemas()

# Function to convert structured text to HTML string
def format_response_to_html(text):
    if not text or not isinstance(text, str):
        return "<p>Error: Invalid response format.</p>"

    lines = text.split('\n')
    html_lines = []
    in_list = False
    current_section = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith('- **'):
            if in_list:
                html_lines.append('</ul>' if current_section == 'bulleted' else '</ol>')
                in_list = False
            section_title = line[4:line.rfind(':**')].strip() if line.endswith(':**') else line[4:].strip()
            html_lines.append(f'<strong>{section_title}:</strong>')
            continue
        elif line.startswith('* - '):
            if not in_list or current_section == 'numbered':
                if in_list:
                    html_lines.append('</ol>' if current_section == 'numbered' else '</ul>')
                html_lines.append('<ul>')
                in_list = True
                current_section = 'bulleted'
            item = line.replace('* - ', '').strip()
            html_lines.append(f'<li>{item}</li>')
        elif re.match(r'^\d+\.', line):
            if not in_list or current_section == 'bulleted':
                if in_list:
                    html_lines.append('</ul>' if current_section == 'bulleted' else '</ol>')
                html_lines.append('<ol>')
                in_list = True
                current_section = 'numbered'
            item = line[line.find(' ') + 1:].strip()
            html_lines.append(f'<li>{item}</li>')
        else:
            if in_list:
                html_lines.append('</ul>' if current_section == 'bulleted' else '</ol>')
                in_list = False
            html_lines.append(f'<p>{line}</p>')

    if in_list:
        html_lines.append('</ul>' if current_section == 'bulleted' else '</ol>')

    return ''.join(html_lines)

# QA Chain Setup for Medical Questions
def get_conversational_chain():
    prompt_template = """
        You are a professional and friendly medical advisor. Assist users with health-related queries based on their medical history and general admin guidelines stored in Weaviate. Provide concise, structured, and user-friendly responses limited to 150-200 words.
        do not answer in more elabrate. give the answer for the question ** behave like a chatbot. **
        *Admin Context:* {context}  
        *User History:* {user_history}  
        *Current Question:* {question}  

        ### *Response Guidelines:*(if needed and give only the necessary information and sub headings)
        - **Greeting & Acknowledgment**:  
          Greet the user by name (if available) or generically and acknowledge the query briefly. This should be a standalone paragraph before any section.  

        - **Health Advice** (if applicable):  
          Provide 2-3 key health recommendations as bullet points using '* - '.  

        - **Medical Insights** (if applicable):  
          Share 2-3 relevant insights (e.g., possible causes, general info) as bullet points using '* - '.  

        - **Required Information** (if needed):  
          List up to 3 missing details as numbered points (e.g., '1. ', '2. '). Provide a brief explanation for each.  

        - **Next Steps & Support**:  
          Offer 1-2 actionable steps and include a call to action (e.g., "Would you like more details?").  

        *Constraints:*  
        - Always start sections with '- **Section Name:**' (e.g., '- **Health Advice:**').  
        - Use '* - ' for bullet points under sections.  
        - Use numbered lists (e.g., '1. ') for required information.  
        - Avoid markdown symbols like '**' within the content (e.g., do not bold individual words in sentences).  
        - Avoid medical jargon unless explained.  
        - Focus on general medical data from the admin context.  
        - If the query is vague, assume it’s about general health advice or symptom explanation and provide relevant details.

        *Answer:*  
        (Generate a structured response following the guidelines.)
    """

    model = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0.5, google_api_key=GOOGLE_API_KEY)
    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "user_history", "question"])
    chain = load_qa_chain(model, chain_type="stuff", prompt=prompt)
    return chain

# General conversational response
def get_general_response(user_message, user_history):
    model = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0.7, google_api_key=GOOGLE_API_KEY)
    if "hi" in user_message.lower() or "hello" in user_message.lower():
        return "Hello! I'm your medical assistant. How can I help you with your health today?"
    elif "name" in user_message.lower() and "?" in user_message:
        try:
            name_part = user_history.split("full_name:")[1].split(",")[0].strip()
            return f"Nice to meet you! Your name is {name_part}, based on your profile."
        except IndexError:
            return "I couldn’t find your name in your profile. Could you please update your details?"
    else:
        response = model.invoke(f"Respond conversationally to: '{user_message}' as a medical advisor")
        return response.content

# Food Analysis Prompt
def analyze_food_with_health_and_knowledge(food_label, confidence, user_history, context, input_documents=None):
    food_analysis_model = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0.3, google_api_key=GOOGLE_API_KEY)
    prompt_template = """
        You are a dietary chatbot assisting a user. Analyze the suitability of the identified food based on the user's health profile and available food-related knowledge. Provide a conversational, structured response limited to 150-200 words.
        do not answer in more elabrate. give the answer for the question ** behave like a chatbot. **
        *Food Identified:* {food_label} (confidence: {confidence}%)  
        *User Health Profile:* {user_history}  
        *Food Knowledge Context:* {context}  

        ### *Response Guidelines:**(if needed and give only the necessary information and sub headings)
        - **Greeting & Acknowledgment**:  
          Greet the user by name (if available) or generically and acknowledge the food identification briefly. This should be a standalone paragraph.  

        - **Dietary Recommendations** (if applicable):  
          Offer 2-3 key dietary suggestions as bullet points using '* - '. Tailor to user history (e.g., allergies, conditions).  

        - **Health Warnings** (if applicable):  
          Highlight 2-3 potential health concerns as bullet points using '* - '. Use user history and food knowledge if available.  

        - **Required Information** (if needed):  
          List up to 2 missing details as numbered points (e.g., '1. ', '2. ') with brief explanations.  

        - **Next Steps & Support**:  
          Suggest 1-2 actionable steps and include a call to action (e.g., "Would you like more details?").  

        *Constraints:*  
        - Start sections with '- **Section Name:**'.  
        - Use '* - ' for bullets, '1. ' for numbered lists.  
        - Avoid jargon unless explained.  
        - Prioritize user history over general knowledge if conflicts arise.  
        - Use general guidelines if food knowledge is absent.

        *Answer:*  
        (Generate a structured response following the guidelines.)
    """
    prompt = PromptTemplate(template=prompt_template, input_variables=["food_label", "confidence", "user_history", "context"])
    chain = load_qa_chain(food_analysis_model, chain_type="stuff", prompt=prompt)
    response = chain.invoke({
        "food_label": food_label,
        "confidence": confidence,
        "user_history": user_history,
        "context": context if context else "No specific food knowledge available. Using general dietary guidelines.",
        "input_documents": input_documents or []
    })
    return response['output_text']

# Helper functions
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(password, hashed_password):
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password)

def generate_token(user_id, is_admin=False):
    payload = {
        "user_id": str(user_id),
        "is_admin": is_admin,
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def sanitize_string(value):
    if not isinstance(value, str):
        return ''
    return value.strip()[:500]

# Helper function to format user profile data for Weaviate
def format_user_profile(user):
    profile = user.get('profile', {})
    personal = profile.get('personal_information', {})
    emergency = profile.get('emergency_contact', {})
    medical = profile.get('medical_history', {})
    lifestyle = profile.get('lifestyle_information', {})
    consent = profile.get('consent_preferences', {})

    fields = {
        'username': user.get('username', 'N/A'),
        'email': user.get('email', 'N/A'),
        'full_name': personal.get('full_name', 'N/A'),
        'date_of_birth': personal.get('date_of_birth', 'N/A'),
        'gender': personal.get('gender', 'N/A'),
        'contact_number': personal.get('contact_number', 'N/A'),
        'home_address': personal.get('home_address', 'N/A'),
        'emergency_contact_name': emergency.get('name', 'N/A'),
        'emergency_contact_relationship': emergency.get('relationship', 'N/A'),
        'emergency_contact_number': emergency.get('contact_number', 'N/A'),
        'chronic_conditions': ', '.join(medical.get('chronic_conditions', [])) or 'None',
        'allergies': ', '.join(medical.get('allergies', [])) or 'None',
        'current_medications': ', '.join(medical.get('current_medications', [])) or 'None',
        'past_surgeries': ', '.join(medical.get('past_surgeries', [])) or 'None',
        'family_medical_history': ', '.join(medical.get('family_medical_history', [])) or 'None',
        'smoking_alcohol': lifestyle.get('smoking_alcohol', 'N/A'),
        'dietary_preferences': lifestyle.get('dietary_preferences', 'N/A'),
        'exercise_routine': lifestyle.get('exercise_routine', 'N/A'),
        'sleep_patterns': lifestyle.get('sleep_patterns', 'N/A'),
        'consent_data_use': str(consent.get('consent_data_use', False)),
        'preferred_communication': consent.get('preferred_communication', 'N/A'),
        'notification_preferences': ', '.join(consent.get('notification_preferences', [])) or 'None'
    }
    return ', '.join(f"{key}: {value}" for key, value in fields.items())

# Function to create Weaviate schema for a user
def create_user_schema(client, user_id):
    class_name = f"User_{user_id}"
    schema = {
        "class": class_name,
        "vectorizer": "none",
        "properties": [
            {"name": "content", "dataType": ["text"]}
        ]
    }
    exists = client.schema.exists(class_name)
    if not exists:
        client.schema.create_class(schema)
        logger.info(f"Created Weaviate class: {class_name}")
    else:
        logger.info(f"Class {class_name} already exists")
    return class_name, exists

# Chunk text function
def chunk_text(text, chunk_size=500):
    """Chunk text into segments of specified word size."""
    words = text.split()
    chunks = [' '.join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]
    logger.info(f"Text chunked into {len(chunks)} segments")
    return chunks

# JWT token verification middleware
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            logger.warning("Token is missing in request")
            return jsonify({"error": "Token is missing"}), 401

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = payload["user_id"]
            is_admin = payload.get("is_admin", False)
            user = users_collection.find_one({"_id": ObjectId(user_id)}) if not is_admin else None
            if not is_admin and not user:
                logger.warning(f"User not found for user_id: {user_id}")
                return jsonify({"error": "User not found"}), 401
        except jwt.ExpiredSignatureError as e:
            logger.error(f"Token has expired: {e}")
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {e}")
            return jsonify({"error": "Invalid token"}), 401

        request.user_id = user_id
        request.is_admin = is_admin
        return f(*args, **kwargs)

    return decorated

# Admin login route
@app.route('/api/admin_login', methods=['POST'])
def admin_login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        admin_user = users_collection.find_one({"email": email, "is_admin": True})
        if not admin_user:
            return jsonify({"error": "Invalid admin credentials"}), 401

        if not verify_password(password, admin_user["password"]):
            return jsonify({"error": "Invalid admin credentials"}), 401

        token = generate_token(admin_user["_id"], is_admin=True)
        return jsonify({
            "message": "Admin login successful",
            "token": token,
            "isAdmin": True
        }), 200
    except Exception as e:
        logger.error(f"Error during admin login: {str(e)}")
        return jsonify({"error": "Failed to log in. Please try again later."}), 500

# Admin route for uploading PDFs
@app.route('/api/upload', methods=['POST'])
@token_required
def admin_upload():
    try:
        if not request.is_admin:
            return jsonify({'error': 'Unauthorized: Admin access required'}), 403

        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if file and file.filename.endswith('.pdf'):
            collection = request.form.get('collection', 'Admin')  # Default to Admin if not specified
            if collection not in ['Admin', 'food_analyse']:
                return jsonify({'error': 'Invalid collection. Use "Admin" or "food_analyse"'}), 400
            result = process_admin_pdf(file, collection)
            return jsonify({'message': result})
        else:
            return jsonify({'error': 'Unsupported file type. Upload a PDF file'}), 400
    except ValueError as e:
        logger.error(f"ValueError in admin PDF processing: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in admin PDF processing: {str(e)}")
        return jsonify({'error': f'Failed to process PDF: {str(e)}'}), 500

# Signup route
@app.route('/api/signup', methods=['POST'])
def signup():
    try:
        logger.debug("Received signup request: %s", request.get_json())
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirmPassword')

        required_fields = ['username', 'email', 'password', 'confirmPassword']
        if not all(data.get(field) for field in required_fields):
            return jsonify({"error": "Username, email, password, and confirm password are required"}), 400

        if password != confirm_password:
            return jsonify({"error": "Passwords do not match"}), 400

        if users_collection.find_one({"email": email}):
            return jsonify({"error": "Email already exists"}), 400

        hashed_password = hash_password(password)
        user = {
            "username": username,
            "email": email,
            "password": hashed_password,
            "profileCompleted": False,
            "created_at": datetime.utcnow(),
            "profile": {
                "personal_information": {},
                "emergency_contact": {},
                "medical_history": {
                    "chronic_conditions": [], "past_surgeries": [], "allergies": [],
                    "current_medications": [], "family_medical_history": []
                },
                "lifestyle_information": {},
                "consent_preferences": {"notification_preferences": []}
            }
        }
        result = users_collection.insert_one(user)
        user_id = str(result.inserted_id)
        token = generate_token(user_id)

        if weaviate_client:
            create_user_schema(weaviate_client, user_id)

        return jsonify({
            "message": "User created successfully",
            "user_id": user_id,
            "token": token,
            "user": {"username": username, "email": email, "profileCompleted": False, "requiresProfileCompletion": True}
        }), 201
    except Exception as e:
        logger.error(f"Error during signup: %s", e)
        return jsonify({"error": "Failed to sign up. Please try again later."}), 500

# Login route
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        if not verify_password(password, user["password"]):
            return jsonify({"error": "Invalid email or password"}), 401

        token = generate_token(user["_id"])
        return jsonify({
            "message": "Login successful",
            "user_id": str(user["_id"]),
            "username": user["username"],
            "token": token,
            "profileCompleted": user.get("profileCompleted", False),
            "requiresProfileCompletion": not user.get("profileCompleted", False)
        }), 200
    except Exception as e:
        logger.error(f"Error during login: %s", e)
        return jsonify({"error": "Failed to log in. Please try again later."}), 500

# Profile setup route (POST)
@app.route('/api/profile', methods=['POST'])
@token_required
def set_profile():
    try:
        user_id = request.user_id
        data = request.get_json()

        full_name = sanitize_string(data.get('fullName', ''))
        date_of_birth = sanitize_string(data.get('dateOfBirth', ''))
        gender = sanitize_string(data.get('gender', ''))
        contact_number = sanitize_string(data.get('contactNumber', ''))
        home_address = sanitize_string(data.get('homeAddress', ''))

        emergency_contact_name = sanitize_string(data.get('emergencyContactName', ''))
        relationship = sanitize_string(data.get('relationship', ''))
        emergency_contact_number = sanitize_string(data.get('emergencyContactNumber', ''))

        chronic_conditions = data.get('chronicConditions', [])
        past_surgeries = data.get('pastSurgeries', [])
        allergies = data.get('allergies', [])
        current_medications = data.get('currentMedications', [])
        family_medical_history = data.get('familyMedicalHistory', [])

        smoking_alcohol = sanitize_string(data.get('smokingAlcohol', ''))
        dietary_preferences = sanitize_string(data.get('dietaryPreferences', ''))
        exercise_routine = sanitize_string(data.get('exerciseRoutine', ''))
        sleep_patterns = sanitize_string(data.get('sleepPatterns', ''))

        consent_data_use = data.get('consentDataUse', False)
        preferred_communication = data.get('preferredCommunication', 'Email')
        notification_preferences = data.get('notificationPreferences', [])

        if gender:
            valid_genders = ["male", "female", "other"]
            if gender.lower() not in valid_genders:
                return jsonify({"error": "Invalid gender. Must be 'male', 'female', or 'other'"}), 400
            gender = gender.lower()
        else:
            gender = ''

        for field, value in [('chronic_conditions', chronic_conditions), ('past_surgeries', past_surgeries),
                             ('allergies', allergies), ('current_medications', current_medications),
                             ('family_medical_history', family_medical_history),
                             ('notification_preferences', notification_preferences)]:
            if not isinstance(value, list):
                return jsonify({"error": f"{field} must be a list"}), 400

        if not isinstance(consent_data_use, bool):
            return jsonify({"error": "Consent for data use must be a boolean"}), 400

        if preferred_communication:
            valid_communications = ["Email", "SMS", "Call"]
            if preferred_communication not in valid_communications:
                return jsonify({"error": "Preferred communication must be 'Email', 'SMS', or 'Call'"}), 400
        else:
            preferred_communication = 'Email'

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        email_address = user.get("email", "")

        profile = {
            "personal_information": {"full_name": full_name, "date_of_birth": date_of_birth, "gender": gender,
                                     "contact_number": contact_number, "email_address": email_address,
                                     "home_address": home_address},
            "emergency_contact": {"name": emergency_contact_name, "relationship": relationship,
                                  "contact_number": emergency_contact_number},
            "medical_history": {"chronic_conditions": chronic_conditions, "past_surgeries": past_surgeries,
                                "allergies": allergies, "current_medications": current_medications,
                                "family_medical_history": family_medical_history},
            "lifestyle_information": {"smoking_alcohol": smoking_alcohol, "dietary_preferences": dietary_preferences,
                                      "exercise_routine": exercise_routine, "sleep_patterns": sleep_patterns},
            "consent_preferences": {"consent_data_use": consent_data_use,
                                    "preferred_communication": preferred_communication,
                                    "notification_preferences": notification_preferences},
            "updated_at": datetime.utcnow()
        }
        personal_info_fields = [full_name, date_of_birth, gender, contact_number, home_address]
        profile_completed = any(field for field in personal_info_fields)

        updated_user = users_collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": {"profile": profile, "profileCompleted": profile_completed}},
            return_document=True
        )

        if weaviate_client:
            class_name, exists = create_user_schema(weaviate_client, user_id)
            try:
                if exists:
                    result = weaviate_client.data_object.get(class_name=class_name)
                    if result and 'objects' in result:
                        for obj in result['objects']:
                            weaviate_client.data_object.delete(
                                uuid=obj['_additional']['id'],
                                class_name=class_name
                            )
                        logger.info(f"Deleted existing objects in Weaviate class: {class_name}")
                formatted_data = format_user_profile(updated_user)
                logger.info(f"Formatted user profile for Weaviate: {formatted_data}")
                chunks = chunk_text(formatted_data, chunk_size=500)
                embeddings_list = embeddings.embed_documents(chunks)
                weaviate_client.data_object.create_many(
                    [{"text": chunk, "vector": embedding} for chunk, embedding in zip(chunks, embeddings_list)],
                    class_name=class_name
                )
                logger.info(f"Stored/Updated user data in Weaviate class: {class_name}")
            except Exception as e:
                logger.error(f"Error storing/updating data in Weaviate: {str(e)}")

        return jsonify({"message": "Profile saved successfully"}), 200
    except Exception as e:
        logger.error(f"Error during profile setup: {str(e)}")
        return jsonify({"error": "Failed to save profile. Please try again later."}), 500

# Profile retrieval route (GET)
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile():
    try:
        user_id = request.user_id
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user or "profile" not in user:
            return jsonify({"error": "Profile not found"}), 404
        profile = user["profile"]
        if "updated_at" in profile and isinstance(profile["updated_at"], datetime):
            profile["updated_at"] = profile["updated_at"].isoformat()
        return jsonify({"profile": profile}), 200
    except Exception as e:
        logger.error(f"Error during profile retrieval: {str(e)}")
        return jsonify({"error": "Failed to retrieve profile. Please try again later."}), 500

# Chat route for text-based queries
@app.route('/api/ask', methods=['POST'])
@token_required
def ask():
    try:
        data = request.get_json()
        user_message = data.get('message')
        user_id = request.user_id
        logger.info(f"User {user_id} entered in chat: {user_message}")

        if not user_message:
            return jsonify({'error': 'Message is required'}), 400

        user_class_name = f"User_{user_id}"
        user_vector_store = Weaviate(
            client=weaviate_client,
            index_name=user_class_name,
            text_key="content",
            embedding=embeddings,
            by_text=False
        )
        user_docs = user_vector_store.similarity_search(user_message, k=1)
        user_history = "\n".join([d.page_content for d in user_docs]) if user_docs else "No user history available."

        medical_report_class_name = f"User_{user_id}_MedicalReport"
        medical_report_docs = []
        if weaviate_client and weaviate_client.schema.exists(medical_report_class_name):
            medical_report_vector_store = Weaviate(
                client=weaviate_client,
                index_name=medical_report_class_name,
                text_key="text",
                embedding=embeddings,
                by_text=False
            )
            medical_report_docs = medical_report_vector_store.similarity_search(user_message, k=3)

        user_name = "there"
        try:
            if user_history and "full_name:" in user_history:
                user_name = user_history.split("full_name:")[1].split(",")[0].strip()
        except IndexError:
            user_name = "there"

        if any(keyword in user_message.lower() for keyword in ["hi", "hello", "name"]):
            response = get_general_response(user_message, user_history)
            formatted_response = format_response_to_html(response)
            return jsonify({'response': formatted_response})

        is_fever_related = "fever" in user_message.lower()
        is_diet_related = any(keyword in user_message.lower() for keyword in ["food", "eat", "diet"])

        admin_vector_store = Weaviate(
            client=weaviate_client,
            index_name="Admin",
            text_key="text",
            embedding=embeddings,
            by_text=False
        )
        admin_docs = admin_vector_store.similarity_search(user_message, k=3)

        chain = get_conversational_chain()
        context_docs = admin_docs + medical_report_docs if medical_report_docs else admin_docs
        if is_fever_related and is_diet_related and "No user history available" in user_history:
            response = chain.invoke({
                "input_documents": context_docs,
                "user_history": "User reports a fever but no detailed medical history provided.",
                "question": f"Hi {user_name}! What types of food can someone with a fever eat based on general nutritional guidelines?"
            })
        else:
            response = chain.invoke({
                "input_documents": context_docs,
                "user_history": user_history,
                "question": f"Hi {user_name}! {user_message}"
            })

        formatted_response = format_response_to_html(response['output_text'])
        logger.info(f"Raw response: {response['output_text']}")
        logger.info(f"Formatted response: {formatted_response}")
        return jsonify({'response': formatted_response})
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}")
        return jsonify({'error': f"Failed to process chat request: {str(e)}"}), 500

# User image upload route for food detection
@app.route('/api/upload-image', methods=['POST'])
@token_required
def upload_image():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No image selected'}), 400

        if file and (file.filename.endswith('.jpg') or file.filename.endswith('.jpeg')):
            # Load the SavedModel using TFSMLayer
            model_path = "D:/Users 2.o/PY charm/flask/chatbot/medical-bot-backend/model/final_v1_xception_savedmodel"
            model = TFSMLayer(model_path, call_endpoint='serving_default')
            logger.info("Model loaded successfully.")

            # Class labels
            class_labels = [
                'Aloo_matar', 'Besan_cheela', 'Biryani', 'Chapathi', 'Chole_bature',
                'Dahl', 'Dhokla', 'Dosa', 'Gulab_jamun', 'Idli',
                'Jalebi', 'Kadai_paneer', 'Naan', 'Paani_puri', 'Pakoda',
                'Pav_bhaji', 'Poha', 'Rolls', 'Samosa', 'Vada_pav'
            ]

            # Preprocessing function
            def preprocess_image_manual(image_path, target_size=(224, 224)):
                img = load_img(image_path, target_size=target_size)
                img_array = img_to_array(img)
                img_array = np.expand_dims(img_array, axis=0)
                img_array = img_array / 255.0  # Normalize as per the standalone code
                return img_array

            # Save temporary image and detect food
            image_path = f"temp_{file.filename}"
            file.save(image_path)

            # Predict
            processed_image = preprocess_image_manual(image_path)
            outputs = model(processed_image, training=False)
            predictions = list(outputs.values())[0].numpy()

            predicted_class_index = np.argmax(predictions, axis=1)[0]
            predicted_class_label = class_labels[predicted_class_index]
            confidence = predictions[0][predicted_class_index] * 100
            logger.info(f"Detected food: {predicted_class_label} with confidence {confidence:.2f}%")

            os.remove(image_path)  # Clean up temporary file

            # User and Food Knowledge Retrieval (Chatbot-style)
            logger.info("Retrieving user profile and food knowledge...")
            user_id = request.user_id
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            user_history = format_user_profile(user) if user else "No user history available."
            food_knowledge = "No specific food knowledge available."
            food_docs = []  # Initialize to avoid UnboundLocalError

            if weaviate_client and weaviate_client.schema.exists("food_analyse"):
                food_vector_store = Weaviate(
                    client=weaviate_client,
                    index_name="food_analyse",
                    text_key="text",
                    embedding=embeddings,
                    by_text=False
                )
                try:
                    count = weaviate_client.query.aggregate("food_analyse").with_meta_count().do().get("data", {}).get("Aggregate", {}).get("food_analyse", [{}])[0].get("meta", {}).get("count", 0)
                    if count > 0:
                        food_docs = food_vector_store.similarity_search(predicted_class_label, k=3)
                        food_knowledge = "\n".join([d.page_content for d in food_docs]) if food_docs else "No specific food knowledge available."
                        logger.info("Successfully retrieved food knowledge from Weaviate.")
                    else:
                        logger.warning("food_analyse collection is empty.")
                except Exception as e:
                    logger.warning(f"Similarity search failed: {str(e)}. Falling back to general guidelines.")
            else:
                logger.warning("food_analyse class does not exist or Weaviate client is unavailable.")

            # Food Analysis with LLM (Chatbot-style)
            logger.info("Analyzing food suitability with LLM...")
            question = f"What are the dietary recommendations for {predicted_class_label} based on the user's health profile?"
            analysis_text = analyze_food_with_health_and_knowledge(
                predicted_class_label,
                confidence,
                user_history,
                food_knowledge if food_knowledge != "No specific food knowledge available" else "No specific food knowledge available. Using general dietary guidelines.",
                input_documents=food_docs if food_docs else []
            )
            logger.info(f"Food analysis response: {analysis_text}")
            logger.info(f"Response length: {len(analysis_text)} characters")

            # Response Generation and Storage (Chatbot-style)
            logger.info("Formatting and storing the response...")
            formatted_response = format_response_to_html(analysis_text)
            logger.info(f"Formatted response: {formatted_response}")
            if analysis_text and weaviate_client:
                chunks = chunk_text(analysis_text)
                embeddings_list = embeddings.embed_documents(chunks)
                with weaviate_client.batch as batch:
                    for chunk, embedding in zip(chunks, embeddings_list):
                        batch.add_data_object(
                            data_object={"text": chunk},
                            class_name="food_analyse",
                            vector=embedding
                        )
                # Safely handle aggregate query
                try:
                    count = weaviate_client.query.aggregate("food_analyse").with_meta_count().do().get("data", {}).get("Aggregate", {}).get("food_analyse", [{}])[0].get("meta", {}).get("count", 0)
                except (KeyError, IndexError) as e:
                    logger.warning(f"Failed to retrieve count for food_analyse: {str(e)}. Defaulting to 0.")
                    count = 0
            else:
                logger.warning("No analysis text or Weaviate client available. Skipping upload.")
                count = 0

            # Return chatbot-style response
            response = {
                'message': f"I’ve detected {predicted_class_label} with {confidence:.2f}% confidence. Here’s my analysis:",
                'analysis': formatted_response,
                'storage_info': f"Analysis stored in food_analyse. Total objects: {count}"
            }
            logger.info(f"Returning response: {json.dumps(response)}")  # Debug the exact response
            return jsonify(response)
        else:
            return jsonify({'error': 'Unsupported file type. Upload an image (JPG/JPEG)'}), 400
    except Exception as e:
        logger.error(f"Error during image upload: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to process image: {str(e)}'}), 500

# Add new route for medical report upload and OCR with summary
@app.route('/api/upload-medical-report', methods=['POST'])
@token_required
def upload_medical_report():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        user_id = request.user_id
        collection_name = f"User_{user_id}_MedicalReport"
        extracted_text = ""

        # Create Weaviate schema if it doesn't exist
        if weaviate_client and not weaviate_client.schema.exists(collection_name):
            schema = {
                "class": collection_name,
                "vectorizer": "none",
                "properties": [
                    {"name": "text", "dataType": ["text"]}
                ]
            }
            weaviate_client.schema.create_class(schema)
            logger.info(f"Created Weaviate class: {collection_name}")

        # Process file based on type
        if file.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
            # Save temporary file for OCR
            temp_path = f"temp_{file.filename}"
            file.save(temp_path)
            result = ocr.ocr(temp_path, cls=True)
            extracted_text = "\n".join([line[1][0] for line in result[0] if line])
            os.remove(temp_path)
        elif file.filename.lower().endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(file)
            extracted_text = "\n".join([page.extract_text() or "" for page in pdf_reader.pages])

        if not extracted_text:
            return jsonify({'error': 'No text extracted from the file'}), 400

        # Chunk and store in Weaviate
        chunks = chunk_text(extracted_text, chunk_size=500)
        embeddings_list = embeddings.embed_documents(chunks)
        with weaviate_client.batch as batch:
            for chunk, embedding in zip(chunks, embeddings_list):
                batch.add_data_object(
                    data_object={"text": chunk},
                    class_name=collection_name,
                    vector=embedding
                )
        logger.info(f"Stored extracted text in {collection_name}")

        # Generate summary using LLM
        medical_report_vector_store = Weaviate(
            client=weaviate_client,
            index_name=collection_name,
            text_key="text",
            embedding=embeddings,
            by_text=False
        )
        report_docs = medical_report_vector_store.similarity_search("summary", k=3)
        report_context = "\n".join([d.page_content for d in report_docs]) if report_docs else extracted_text[:1000]  # Limit context

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        user_history = format_user_profile(user) if user else "No user history available."
        user_name = user_history.split("full_name:")[1].split(",")[0].strip() if "full_name:" in user_history else "there"

        chain = get_conversational_chain()
        summary_response = chain.invoke({
            "input_documents": [Document(page_content=report_context)],
            "user_history": user_history,
            "question": f"Hi {user_name}! Provide a concise summary of the following medical report: {report_context}"
        })
        summary = format_response_to_html(summary_response['output_text'])

        return jsonify({
            'summary': summary,
            'response': '<p>Your medical report has been processed. Please ask any questions!</p>'
        })
    except Exception as e:
        logger.error(f"Error processing medical report: {str(e)}")
        return jsonify({'error': f'Failed to process medical report: {str(e)}'}), 500

# Add logout route to delete user-specific collection
@app.route('/api/logout', methods=['POST'])
@token_required
def logout_user():
    try:
        user_id = request.user_id
        collection_name = f"User_{user_id}_MedicalReport"
        logger.info(f"Attempting to clean up Weaviate collection: {collection_name} for user_id: {user_id}")

        if weaviate_client:
            # Check if the collection exists
            if weaviate_client.schema.exists(collection_name):
                logger.info(f"Collection {collection_name} exists. Proceeding with cleanup.")

                # Step 1: Delete all objects in the collection
                try:
                    # Use a query to fetch all objects and delete them
                    response = weaviate_client.query.get(collection_name, ["text"]).do()
                    objects = response.get('data', {}).get('Get', {}).get(collection_name, [])
                    if objects:
                        for obj in objects:
                            uuid = obj.get('_additional', {}).get('id')
                            if uuid:
                                weaviate_client.data_object.delete(
                                    uuid=uuid,
                                    class_name=collection_name
                                )
                                logger.info(f"Deleted object with UUID: {uuid} from {collection_name}")
                            else:
                                logger.warning(f"Object missing UUID: {obj}")
                        logger.info(f"Successfully deleted all objects from {collection_name}")
                    else:
                        logger.info(f"No objects found in {collection_name} to delete")
                except Exception as e:
                    logger.error(f"Error deleting objects from {collection_name}: {str(e)}")
                    # Continue to schema deletion even if object deletion fails

                # Step 2: Delete the schema
                try:
                    weaviate_client.schema.delete_class(collection_name)
                    logger.info(f"Successfully deleted Weaviate class: {collection_name}")
                except Exception as e:
                    logger.error(f"Error deleting schema {collection_name}: {str(e)}")
                    return jsonify({'error': f'Failed to delete schema {collection_name}: {str(e)}'}), 500
            else:
                logger.info(f"Collection {collection_name} does not exist. No cleanup needed.")
        else:
            logger.warning("Weaviate client is not initialized. Skipping cleanup.")
            return jsonify({'warning': 'Weaviate client not available, no cleanup performed'}), 200

        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        logger.error(f"Unexpected error during logout cleanup for user_id {user_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to clean up on logout: {str(e)}'}), 500

# Test route
@app.route('/')
def home():
    return "Medical Bot Backend is running!"

if __name__ == '__main__':
    try:
        debug = os.getenv("FLASK_ENV", "development") == "development"
        app.run(debug=debug, host='0.0.0.0', port=5000)
    finally:
        if client:
            client.close()
            logger.info("MongoDB client closed.")