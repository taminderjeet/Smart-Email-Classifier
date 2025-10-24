"""
Email Classification Model Inference Script
==========================================

This script provides easy-to-use functions for loading and using the trained email classification model.
Use this for production deployment and backend integration.

Usage:
    from inference import EmailClassifier
    
    classifier = EmailClassifier("./email_classification_model")
    result = classifier.predict("Meeting reminder", "Don't forget about today's meeting at 3 PM")
    print(result['top_2_categories'])  # ['business', 'schedule']
"""

import os
import json
import torch
import numpy as np
from typing import Dict, List, Any, Optional
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import warnings

warnings.filterwarnings('ignore')

class EmailClassifier:
    """
    Production-ready email classifier for inference
    """
    
    def __init__(self, model_path: str):
        """
        Initialize the email classifier
        
        Args:
            model_path: Path to the saved model directory
        """
        self.model_path = model_path
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.tokenizer = None
        self.label_mapping = None
        self.reverse_mapping = None
        self.categories = None
        
        self._load_model()
    
    def _load_model(self):
        """Load the trained model and metadata"""
        try:
            # Load metadata
            metadata_path = os.path.join(self.model_path, 'metadata.json')
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            self.label_mapping = metadata['label_mapping']
            self.reverse_mapping = {v: k for k, v in self.label_mapping.items()}
            self.categories = metadata['categories']
            
            # Load tokenizer and model
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_path)
            self.model.to(self.device)
            self.model.eval()
            
            print(f"Model loaded successfully from {self.model_path}")
            print(f"Available categories: {len(self.categories)}")
            print(f"Using device: {self.device}")
            
        except Exception as e:
            raise Exception(f"Failed to load model: {str(e)}")
    
    def predict(self, subject: str, body: str, top_k: int = 2) -> Dict[str, Any]:
        """
        Predict categories for an email
        
        Args:
            subject: Email subject line
            body: Email body content
            top_k: Number of top categories to return (default: 2)
            
        Returns:
            Dictionary containing predictions and confidence scores
        """
        try:
            # Prepare input text
            full_text = f"{subject} {body}".strip()
            
            # Tokenize input
            inputs = self.tokenizer(
                full_text,
                truncation=True,
                padding=True,
                max_length=512,
                return_tensors='pt'
            )
            
            # Move inputs to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Get predictions
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
            
            # Apply sigmoid to get probabilities
            probabilities = torch.sigmoid(logits).squeeze().cpu().numpy()
            
            # Get top k categories
            top_indices = np.argsort(probabilities)[::-1][:top_k]
            top_categories = [self.reverse_mapping[idx] for idx in top_indices]
            top_confidences = [float(probabilities[idx]) for idx in top_indices]
            
            # Create predictions list
            predictions = []
            for i in range(len(top_categories)):
                predictions.append({
                    'category': top_categories[i],
                    'confidence': top_confidences[i]
                })
            
            # Create result
            result = {
                'input_text': full_text,
                'top_categories': top_categories,
                'confidences': top_confidences,
                'predictions': predictions,
                'success': True
            }
            
            # Add top 2 categories for backward compatibility
            if len(top_categories) >= 2:
                result['top_2_categories'] = top_categories[:2]
            else:
                result['top_2_categories'] = top_categories
            
            return result
            
        except Exception as e:
            return {
                'error': str(e),
                'input_text': f"{subject} {body}".strip(),
                'top_categories': [],
                'confidences': [],
                'predictions': [],
                'success': False
            }
    
    def predict_batch(self, emails: List[Dict[str, str]], top_k: int = 2) -> List[Dict[str, Any]]:
        """
        Predict categories for multiple emails
        
        Args:
            emails: List of dictionaries with 'subject' and 'body' keys
            top_k: Number of top categories to return for each email
            
        Returns:
            List of prediction results
        """
        results = []
        for email in emails:
            subject = email.get('subject', '')
            body = email.get('body', '')
            result = self.predict(subject, body, top_k)
            results.append(result)
        
        return results
    
    def get_category_probabilities(self, subject: str, body: str) -> Dict[str, float]:
        """
        Get probabilities for all categories
        
        Args:
            subject: Email subject line
            body: Email body content
            
        Returns:
            Dictionary mapping category names to probabilities
        """
        try:
            # Prepare input text
            full_text = f"{subject} {body}".strip()
            
            # Tokenize input
            inputs = self.tokenizer(
                full_text,
                truncation=True,
                padding=True,
                max_length=512,
                return_tensors='pt'
            )
            
            # Move inputs to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Get predictions
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
            
            # Apply sigmoid to get probabilities
            probabilities = torch.sigmoid(logits).squeeze().cpu().numpy()
            
            # Create probability dictionary
            prob_dict = {}
            for i, category in enumerate(self.categories):
                prob_dict[category] = float(probabilities[i])
            
            # Sort by probability
            prob_dict = dict(sorted(prob_dict.items(), key=lambda x: x[1], reverse=True))
            
            return prob_dict
            
        except Exception as e:
            return {category: 0.0 for category in self.categories}
    
    def get_available_categories(self) -> List[str]:
        """
        Get list of all available categories
        
        Returns:
            List of category names
        """
        return self.categories.copy()

# Standalone functions for backward compatibility
def load_model(model_path: str) -> EmailClassifier:
    """
    Load the email classification model
    
    Args:
        model_path: Path to the saved model directory
        
    Returns:
        EmailClassifier instance
    """
    return EmailClassifier(model_path)

def predict_email_categories(subject: str, body: str, model_path: str = "./email_classification_model") -> Dict[str, Any]:
    """
    Predict the top 2 categories for an email using the trained model
    
    Args:
        subject: Email subject line
        body: Email body content
        model_path: Path to the saved model directory
        
    Returns:
        Dictionary containing predictions and confidence scores
    """
    classifier = EmailClassifier(model_path)
    return classifier.predict(subject, body, top_k=2)

# Example usage and testing
def main():
    """
    Example usage of the EmailClassifier
    """
    print("Email Classification Inference Example")
    print("=" * 50)
    
    # Initialize classifier
    model_path = "./email_classification_model"
    
    try:
        classifier = EmailClassifier(model_path)
        
        # Test emails
        test_emails = [
            {
                "subject": "Meeting reminder for tomorrow",
                "body": "Please don't forget about our team meeting scheduled for tomorrow at 2 PM in the conference room."
            },
            {
                "subject": "Special offer: 50% discount",
                "body": "Limited time offer! Get 50% off on all products. Use code SAVE50 at checkout. Valid until Friday."
            },
            {
                "subject": "System maintenance notification",
                "body": "Our servers will undergo scheduled maintenance tonight from 11 PM to 3 AM. Please plan accordingly."
            },
            {
                "subject": "Invoice #12345 payment due",
                "body": "Your payment for invoice #12345 is due on Friday. Please process the payment to avoid late fees."
            }
        ]
        
        print(f"Available categories: {', '.join(classifier.get_available_categories()[:10])}...")
        print(f"Total categories: {len(classifier.get_available_categories())}")
        print()
        
        # Test individual predictions
        for i, email in enumerate(test_emails, 1):
            print(f"Test Email {i}:")
            print(f"Subject: {email['subject']}")
            print(f"Body: {email['body'][:80]}...")
            
            result = classifier.predict(email['subject'], email['body'])
            
            if result['success']:
                print("Predictions:")
                for j, pred in enumerate(result['predictions'], 1):
                    print(f"  {j}. {pred['category']} (confidence: {pred['confidence']:.3f})")
            else:
                print(f"Error: {result['error']}")
            
            print("-" * 50)
        
        # Test batch prediction
        print("Batch Prediction Results:")
        batch_results = classifier.predict_batch(test_emails)
        for i, result in enumerate(batch_results, 1):
            if result['success']:
                categories = [pred['category'] for pred in result['predictions']]
                print(f"Email {i}: {categories}")
            else:
                print(f"Email {i}: Error - {result['error']}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        print("Make sure you have trained the model first by running train_email_classifier.py")

if __name__ == "__main__":
    main()
