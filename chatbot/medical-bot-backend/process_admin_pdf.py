import weaviate
from pypdf import PdfReader
import google.generativeai as genai
from dotenv import load_dotenv
import os
import logging
import time

# Set up logging to include debug messages
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("Loading process_admin_pdf.py - This is the updated version")

# Load environment variables
load_dotenv()
WEAVIATE_URL = os.getenv("WEAVIATE_URL")
WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

# Initialize Weaviate Client
try:
    client = weaviate.Client(
        url=WEAVIATE_URL,
        auth_client_secret=weaviate.auth.AuthApiKey(api_key=WEAVIATE_API_KEY),
        timeout_config=(10, 60)  # 10s connection, 60s read
    )
    client.get_meta()
    logger.info("Successfully connected to Weaviate Cloud")
except Exception as e:
    logger.error(f"Failed to initialize Weaviate client: {str(e)}")
    raise

# Configure Gemini API
genai.configure(api_key=GEMINI_API_KEY)

# Step 1: Extract text from PDF with enhanced handling for URLs and invalid characters
def extract_text_from_pdf(pdf_file):
    """Extract text from a PDF file object with enhanced handling for URLs and invalid characters."""
    try:
        reader = PdfReader(pdf_file)
        text = ''
        for page_num, page in enumerate(reader.pages):
            extracted = page.extract_text() or ""
            if extracted:
                logger.debug(f"Raw extracted text (page {page_num + 1}, first 100 chars): {repr(extracted[:100])}...")
                cleaned_text = extracted.encode('utf-8', 'replace').decode('utf-8')
                logger.debug(f"Cleaned text (page {page_num + 1}, first 100 chars): {repr(cleaned_text[:100])}...")
                text += cleaned_text + "\n"
        if not text.strip():
            raise ValueError(
                "No text extracted from PDF. This PDF may be image-based or contain corrupted data (e.g., from URLs). Consider using a text-based PDF or OCR.")
        try:
            text.encode('utf-8')
            logger.debug(f"Final text (first 100 chars): {repr(text[:100])}...")
        except UnicodeEncodeError as e:
            logger.error(f"Invalid Unicode detected in final text: {str(e)}")
            raise
        logger.info("Text extracted from PDF successfully")
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        raise

# Step 2: Chunk the text
def chunk_text(text, chunk_size=500):
    """Chunk text into segments of specified word size."""
    words = text.split()
    chunks = [' '.join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]
    logger.info(f"Text chunked into {len(chunks)} segments")
    return chunks

# Step 3: Generate embeddings using Gemini
def generate_embeddings(chunks, max_retries=3):
    """Generate embeddings for text chunks using Gemini with retries."""
    embeddings = []
    for i, chunk in enumerate(chunks):
        attempt = 0
        while attempt < max_retries:
            try:
                logger.info(f"Attempt {attempt + 1}/{max_retries}: Generating embedding for chunk {i + 1}/{len(chunks)}")
                response = genai.embed_content(
                    model="models/embedding-001",
                    content=chunk,
                    task_type="retrieval_document"
                )
                embeddings.append(response['embedding'])
                logger.info(f"Successfully generated embedding for chunk {i + 1}/{len(chunks)}")
                break
            except Exception as e:
                attempt += 1
                logger.error(f"Attempt {attempt}/{max_retries} failed for chunk {i + 1}: {str(e)}")
                if attempt == max_retries:
                    raise
                time.sleep(2 ** attempt)
    logger.info(f"Generated embeddings for {len(embeddings)} chunks")
    return embeddings

# Step 4: Upload to Weaviate
def upload_to_weaviate(chunks, embeddings, collection_name="Admin", max_retries=3):
    """Upload chunks and embeddings to the specified Weaviate collection with retries."""
    try:
        logger.info(f"Starting upload to Weaviate collection: {collection_name}")
        schema_name = collection_name.capitalize()
        schema = {
            "class": schema_name,
            "vectorizer": "none",
            "properties": [{"name": "text", "dataType": ["text"]}]
        }
        if not client.schema.exists(schema_name):
            client.schema.create_class(schema)
            logger.info(f"Created Weaviate class: {schema_name}")
        else:
            logger.info(f"Class {schema_name} already exists")

        # Safely handle object deletion
        try:
            result = client.data_object.get(class_name=schema_name)
            logger.debug(f"Get objects response: {result}")
            if result and isinstance(result, dict) and 'objects' in result and result['objects']:
                for obj in result['objects']:
                    if '_additional' in obj and 'id' in obj['_additional']:
                        client.data_object.delete(uuid=obj['_additional']['id'], class_name=schema_name)
                        logger.info(f"Deleted object with ID: {obj['_additional']['id']}")
                    else:
                        logger.warning(f"Object missing '_additional' or 'id': {obj}")
            else:
                logger.info("No existing objects to delete or invalid response")
        except Exception as e:
            logger.error(f"Error deleting existing objects: {str(e)} - Skipping deletion")
            pass  # Skip deletion if it fails to avoid breaking the process

        # Upload chunks with embeddings
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            attempt = 0
            while attempt < max_retries:
                try:
                    logger.debug(f"Attempt {attempt + 1}/{max_retries}: Uploading chunk {i + 1}/{len(chunks)}")
                    cleaned_chunk = chunk.encode('utf-8', 'replace').decode('utf-8')
                    data_object = {
                        "text": cleaned_chunk,
                        "vector": embedding
                    }
                    logger.debug(f"Data object for chunk {i + 1}: {data_object}")
                    client.data_object.create(
                        data_object=data_object,
                        class_name=schema_name
                    )
                    logger.debug(f"Successfully uploaded chunk {i + 1}/{len(chunks)}")
                    break
                except Exception as e:
                    attempt += 1
                    logger.error(f"Attempt {attempt}/{max_retries} failed for chunk {i + 1}: {str(e)} - Full exception: {repr(e)}")
                    if attempt == max_retries:
                        raise
                    time.sleep(2 ** attempt)
        logger.info(f"Total number of chunks uploaded to {schema_name}: {len(chunks)}")
    except Exception as e:
        logger.error(f"Error uploading to Weaviate: {str(e)} - Full exception: {repr(e)}")
        raise

# Step 5: Count objects in the specified collection
def count_objects_in_collection(collection_name="Admin"):
    """Count the number of objects in the specified Weaviate collection."""
    try:
        schema_name = collection_name.capitalize()
        response = client.query.aggregate(schema_name).with_meta_count().do()
        count = response["data"]["Aggregate"][schema_name][0]["meta"]["count"]
        logger.info(f"Total number of objects in the {schema_name} collection: {count}")
        return count
    except Exception as e:
        logger.error(f"Error counting objects in {collection_name}: {str(e)} - Full exception: {repr(e)}")
        return 0

# Main function to process admin PDF
def process_admin_pdf(file, collection):
    """Process a PDF file and optionally upload to Weaviate."""
    try:
        text = extract_text_from_pdf(file)
        logger.debug(f"Final extracted text (first 100 chars): {repr(text[:100])}...")
        chunks = chunk_text(text)
        embeddings = generate_embeddings(chunks)
        upload_to_weaviate(chunks, embeddings, collection)
        count = count_objects_in_collection(collection)
        return f"Successfully processed PDF for collection {collection}. Extracted text length: {len(text)} characters. Uploaded {count} objects."
    except ValueError as e:
        logger.error(f"Error processing admin PDF: {str(e)}")
        raise ValueError(str(e))
    except Exception as e:
        logger.error(f"Failed to process admin PDF: {str(e)}")
        raise Exception(f"Failed to process PDF: {str(e)}")