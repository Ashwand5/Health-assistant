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
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

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
def upload_to_weaviate(chunks, embeddings, collection_name="Admin", client=None, max_retries=3):
    """Upload chunks and embeddings to the specified Weaviate collection with retries."""
    if not client:
        raise ValueError("Weaviate client must be provided")

    try:
        logger.info(f"Starting upload to Weaviate collection: {collection_name}")
        schema_name = collection_name.capitalize()
        schema = {
            "class": schema_name,
            "vectorizer": "none",
            "properties": [{"name": "text", "dataType": ["text"]}]
        }
        # Check if the class exists with retry logic
        attempt = 0
        while attempt < max_retries:
            try:
                if not client.schema.exists(schema_name):
                    client.schema.create_class(schema)
                    logger.info(f"Created Weaviate class: {schema_name}")
                else:
                    logger.info(f"Class {schema_name} already exists")
                break
            except Exception as e:
                attempt += 1
                logger.error(f"Attempt {attempt}/{max_retries} failed to check/create class {schema_name}: {str(e)}")
                if attempt == max_retries:
                    raise
                time.sleep(2 ** attempt)

        # Safely handle object deletion
        attempt = 0
        while attempt < max_retries:
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
                break
            except Exception as e:
                attempt += 1
                logger.error(f"Attempt {attempt}/{max_retries} failed to delete objects: {str(e)}")
                if attempt == max_retries:
                    logger.warning("Skipping deletion due to persistent errors")
                    break
                time.sleep(2 ** attempt)

        # Upload chunks with embeddings using batch API
        with client.batch as batch:
            batch.batch_size = 100  # Adjust batch size if needed
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                try:
                    logger.debug(f"Uploading chunk {i + 1}/{len(chunks)}")
                    cleaned_chunk = chunk.encode('utf-8', 'replace').decode('utf-8')
                    batch.add_data_object(
                        data_object={"text": cleaned_chunk},
                        class_name=schema_name,
                        vector=embedding
                    )
                    logger.debug(f"Successfully queued chunk {i + 1}/{len(chunks)} for upload")
                except Exception as e:
                    logger.error(f"Failed to queue chunk {i + 1}/{len(chunks)}: {str(e)}")
                    raise
        logger.info(f"Total number of chunks uploaded to {schema_name}: {len(chunks)}")
    except Exception as e:
        logger.error(f"Error uploading to Weaviate: {str(e)} - Full exception: {repr(e)}")
        raise

# Step 5: Count objects in the specified collection
def count_objects_in_collection(collection_name="Admin", client=None):
    """Count the number of objects in the specified Weaviate collection."""
    if not client:
        raise ValueError("Weaviate client must be provided")

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
def process_admin_pdf(file, collection, weaviate_client=None):
    """Process a PDF file and upload to Weaviate using the provided client."""
    try:
        text = extract_text_from_pdf(file)
        logger.debug(f"Final extracted text (first 100 chars): {repr(text[:100])}...")
        chunks = chunk_text(text)
        embeddings = generate_embeddings(chunks)
        upload_to_weaviate(chunks, embeddings, collection, client=weaviate_client)
        count = count_objects_in_collection(collection, client=weaviate_client)
        return f"Successfully processed PDF for collection {collection}. Extracted text length: {len(text)} characters. Uploaded {count} objects."
    except ValueError as e:
        logger.error(f"Error processing admin PDF: {str(e)}")
        raise ValueError(str(e))
    except Exception as e:
        logger.error(f"Failed to process admin PDF: {str(e)}")
        raise Exception(f"Failed to process PDF: {str(e)}")