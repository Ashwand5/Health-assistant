import numpy as np
import torch
from transformers import BertTokenizer, BertModel
import nltk
from sklearn.metrics.pairwise import cosine_similarity
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

nltk.download('punkt')

class TextSummarizer:
    def __init__(self, model_name='bert-base-uncased'):
        """Initialize the summarizer with BERT model and tokenizer."""
        try:
            self.tokenizer = BertTokenizer.from_pretrained(model_name)
            self.model = BertModel.from_pretrained(model_name, output_hidden_states=True)
            self.model.eval()  # Set model to evaluation mode
            logger.info(f"Successfully initialized {model_name}")
        except Exception as e:
            logger.error(f"Error initializing model: {str(e)}")
            raise

    def preprocess_text(self, text):
        """
        Preprocess input text into sentences.

        Args:
            text (str): Input text to preprocess

        Returns:
            list: List of sentences
        """
        try:
            sentences = nltk.sent_tokenize(text.strip())
            if not sentences:
                raise ValueError("No sentences detected in the input text")
            return sentences
        except Exception as e:
            logger.error(f"Error in preprocessing: {str(e)}")
            return []

    def get_bert_embedding(self, sentence, max_length=128):
        """
        Generate BERT embedding for a sentence.

        Args:
            sentence (str): Input sentence
            max_length (int): Maximum token length

        Returns:
            numpy.ndarray: Sentence embedding
        """
        try:
            # Tokenize with optimization
            tokens = self.tokenizer(
                sentence,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=max_length
            )

            with torch.no_grad():
                outputs = self.model(**tokens)
                # Use [CLS] token embedding instead of mean pooling for better representation
                embedding = outputs.last_hidden_state[:, 0, :].squeeze().numpy()
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            return np.zeros(768)  # Return zero vector as fallback

    def extractive_summary(self, text, num_sentences=3, min_similarity=0.1):
        """
        Generate an extractive summary of the input text.

        Args:
            text (str): Input text to summarize
            num_sentences (int): Number of sentences in summary
            min_similarity (float): Minimum similarity threshold

        Returns:
            str: Summary text
        """
        try:
            # Preprocess text
            sentences = self.preprocess_text(text)
            if len(sentences) < num_sentences:
                return " ".join(sentences)

            # Get embeddings
            sentence_embeddings = np.array([self.get_bert_embedding(sent) for sent in sentences])

            # Compute similarity matrix
            similarity_matrix = cosine_similarity(sentence_embeddings)

            # Apply minimum similarity threshold
            similarity_matrix[similarity_matrix < min_similarity] = 0

            # Normalize scores by sentence length to avoid bias
            sentence_lengths = np.array([len(sent.split()) for sent in sentences])
            sentence_scores = similarity_matrix.sum(axis=1) / (sentence_lengths + 1)  # Add 1 to avoid division by zero

            # Get top sentences
            ranked_indices = np.argsort(sentence_scores)[-num_sentences:]
            ranked_sentences = [sentences[i] for i in sorted(ranked_indices)]  # Sort by original order

            return " ".join(ranked_sentences)

        except Exception as e:
            logger.error(f"Error in summarization: {str(e)}")
            return "Error generating summary"

# Example usage
if __name__ == "__main__":
    summarizer = TextSummarizer()

    text = """Artificial Intelligence (AI) is a rapidly advancing field that aims to create intelligent machines.
    It involves various subfields such as machine learning, deep learning, and natural language processing.
    AI is used in numerous applications including healthcare, finance, and autonomous systems.
    With the increasing availability of data and computational power, AI continues to make remarkable progress.
    However, ethical considerations and biases remain significant challenges in AI development."""

    summary = summarizer.extractive_summary(text, num_sentences=2)
    print("Summary:")
    print(summary)
