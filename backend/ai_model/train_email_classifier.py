"""
Complete End-to-End Email Classification Training Pipeline
=========================================================

This script trains a high-accuracy multi-label email classifier using DistilBERT.
The model predicts the top 2 most likely categories for each email based on subject and body.

Requirements (install via: pip install -r requirements.txt):
- torch>=2.0.0
- transformers>=4.30.0  
- datasets>=2.12.0
- scikit-learn>=1.3.0
- pandas>=2.0.0
- numpy>=1.24.0
- tqdm>=4.65.0
- accelerate>=0.20.0

Author: ML Engineering Team
Date: September 2025
"""

import os
import json
import warnings
import numpy as np
import pandas as pd
from typing import List, Tuple, Dict, Any
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.metrics import f1_score, accuracy_score, hamming_loss, jaccard_score
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    TrainingArguments, 
    Trainer,
    pipeline
)
from datasets import Dataset as HFDataset
import logging

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')
logging.getLogger("transformers").setLevel(logging.ERROR)

# Configuration
CONFIG = {
    "model_name": "distilbert-base-uncased",
    "max_length": 512,
    "batch_size": 16,
    "learning_rate": 2e-5,
    "num_epochs": 4,
    "warmup_steps": 500,
    "weight_decay": 0.01,
    "save_directory": "./email_classification_model",
    "train_test_split": 0.9,
    "random_state": 42
}

class EmailClassificationDataset(Dataset):
    """
    Custom PyTorch Dataset for email classification
    """
    def __init__(self, texts: List[str], labels: np.ndarray, tokenizer, max_length: int = 512):
        """
        Initialize the dataset
        
        Args:
            texts: List of email texts (subject + body combined)
            labels: Multi-hot encoded labels array
            tokenizer: Hugging Face tokenizer
            max_length: Maximum sequence length for tokenization
        """
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        """
        Get a single item from the dataset
        """
        text = str(self.texts[idx])
        labels = self.labels[idx]
        
        # Tokenize the text
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.FloatTensor(labels)
        }

class EmailClassificationTrainer:
    """
    Main trainer class for email classification model
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the trainer with configuration
        
        Args:
            config: Configuration dictionary containing model parameters
        """
        self.config = config
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.tokenizer = None
        self.model = None
        self.mlb = None
        self.label_mapping = None
        
        print(f"Using device: {self.device}")
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
            print(f"GPU: {gpu_name}")
            print(f"GPU Memory: {gpu_memory:.1f} GB")
    
    def load_and_preprocess_data(self, csv_path: str) -> Tuple[List[str], np.ndarray]:
        """
        Load and preprocess the email dataset
        
        Args:
            csv_path: Path to the CSV file containing email data
            
        Returns:
            Tuple of (texts, labels) where texts is a list of combined subject+body
            and labels is a multi-hot encoded array
        """
        print("Loading and preprocessing data...")
        
        # Load the CSV file
        try:
            df = pd.read_csv(csv_path)
            print(f"Loaded {len(df)} emails from {csv_path}")
        except FileNotFoundError:
            raise FileNotFoundError(f"Could not find the file: {csv_path}")
        except Exception as e:
            raise Exception(f"Error loading CSV file: {str(e)}")
        
        # Validate required columns - adjust for your CSV format
        required_columns = ['Subject', 'Body', 'Category 1', 'Category 2']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
        
        # Handle missing values and normalize column names
        df['subject'] = df['Subject'].fillna('')
        df['body'] = df['Body'].fillna('')
        df['category1'] = df['Category 1'].fillna('uncategorized')
        df['category2'] = df['Category 2'].fillna('uncategorized')
        
        # Combine subject and body into full_text
        df['full_text'] = df['subject'].astype(str) + ' ' + df['body'].astype(str)
        
        # Clean the text
        df['full_text'] = df['full_text'].str.strip()
        df['full_text'] = df['full_text'].str.replace(r'\s+', ' ', regex=True)
        
        print(f"Text preprocessing completed. Average text length: {df['full_text'].str.len().mean():.0f} characters")
        
        # Prepare labels for multi-label classification
        all_categories = set()
        for _, row in df.iterrows():
            if pd.notna(row['category1']) and row['category1'].strip():
                all_categories.add(row['category1'].strip().lower())
            if pd.notna(row['category2']) and row['category2'].strip():
                all_categories.add(row['category2'].strip().lower())
        
        # Remove 'uncategorized' if it exists and add it back at the end
        all_categories.discard('uncategorized')
        all_categories = sorted(list(all_categories)) + ['uncategorized']
        
        print(f"Found {len(all_categories)} unique categories: {all_categories[:10]}{'...' if len(all_categories) > 10 else ''}")
        
        # Create category mapping
        self.label_mapping = {category: idx for idx, category in enumerate(all_categories)}
        reverse_mapping = {idx: category for category, idx in self.label_mapping.items()}
        
        # Convert categories to multi-hot encoded vectors
        labels_list = []
        for _, row in df.iterrows():
            label_vector = [0] * len(all_categories)
            
            # Process category1
            if pd.notna(row['category1']) and row['category1'].strip():
                cat1 = row['category1'].strip().lower()
                if cat1 in self.label_mapping:
                    label_vector[self.label_mapping[cat1]] = 1
            
            # Process category2
            if pd.notna(row['category2']) and row['category2'].strip():
                cat2 = row['category2'].strip().lower()
                if cat2 in self.label_mapping and cat2 != row['category1'].strip().lower():
                    label_vector[self.label_mapping[cat2]] = 1
            
            # If no categories were assigned, mark as uncategorized
            if sum(label_vector) == 0:
                label_vector[self.label_mapping['uncategorized']] = 1
            
            labels_list.append(label_vector)
        
        # Convert to numpy array
        labels_array = np.array(labels_list)
        
        # Print label statistics
        label_counts = labels_array.sum(axis=0)
        print(f"Label distribution (top 10):")
        for i in np.argsort(label_counts)[::-1][:10]:
            print(f"  {reverse_mapping[i]}: {int(label_counts[i])} emails")
        
        # Store the MultiLabelBinarizer for later use
        self.mlb = MultiLabelBinarizer()
        self.mlb.classes_ = np.array(all_categories)
        
        return df['full_text'].tolist(), labels_array
    
    def create_model_and_tokenizer(self, num_labels: int):
        """
        Initialize the tokenizer and model for multi-label classification
        
        Args:
            num_labels: Number of unique categories/labels
        """
        print(f"Initializing model and tokenizer for {num_labels} labels...")
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(self.config['model_name'])
        
        # Load model for multi-label classification
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.config['model_name'],
            num_labels=num_labels,
            problem_type="multi_label_classification"
        )
        
        # Move model to device
        self.model.to(self.device)
        
        print(f"Model loaded: {self.config['model_name']}")
        print(f"Model parameters: {sum(p.numel() for p in self.model.parameters()):,}")
    
    def compute_metrics(self, eval_pred):
        """
        Compute evaluation metrics for multi-label classification
        
        Args:
            eval_pred: Evaluation predictions from the trainer
            
        Returns:
            Dictionary containing computed metrics
        """
        predictions, labels = eval_pred
        
        # Apply sigmoid to get probabilities
        sigmoid = torch.nn.Sigmoid()
        probs = sigmoid(torch.tensor(predictions)).numpy()
        
        # Convert probabilities to binary predictions (threshold = 0.5)
        y_pred = (probs > 0.5).astype(int)
        y_true = labels
        
        # Calculate metrics
        metrics = {
            'f1_micro': f1_score(y_true, y_pred, average='micro'),
            'f1_macro': f1_score(y_true, y_pred, average='macro'),
            'f1_weighted': f1_score(y_true, y_pred, average='weighted'),
            'accuracy': accuracy_score(y_true, y_pred),
            'hamming_loss': hamming_loss(y_true, y_pred),
            'jaccard_score': jaccard_score(y_true, y_pred, average='macro')
        }
        
        return metrics
    
    def train_model(self, texts: List[str], labels: np.ndarray):
        """
        Train the email classification model
        
        Args:
            texts: List of email texts
            labels: Multi-hot encoded labels
        """
        print("Starting model training...")
        
        # Split the data
        train_texts, val_texts, train_labels, val_labels = train_test_split(
            texts, 
            labels, 
            test_size=1-self.config['train_test_split'],
            random_state=self.config['random_state'],
            stratify=None  # Multi-label stratification is complex, skip for now
        )
        
        print(f"Training set size: {len(train_texts)}")
        print(f"Validation set size: {len(val_texts)}")
        
        # Create datasets
        train_dataset = EmailClassificationDataset(
            train_texts, train_labels, self.tokenizer, self.config['max_length']
        )
        val_dataset = EmailClassificationDataset(
            val_texts, val_labels, self.tokenizer, self.config['max_length']
        )
        
        # Training arguments
        training_args = TrainingArguments(
            output_dir='./training_output',
            num_train_epochs=self.config['num_epochs'],
            per_device_train_batch_size=self.config['batch_size'],
            per_device_eval_batch_size=self.config['batch_size'],
            warmup_steps=self.config['warmup_steps'],
            weight_decay=self.config['weight_decay'],
            learning_rate=self.config['learning_rate'],
            logging_dir='./logs',
            logging_steps=100,
            eval_strategy="epoch",  # Updated parameter name
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model='f1_micro',
            greater_is_better=True,
            save_total_limit=2,
            report_to=None,  # Disable wandb/tensorboard
            dataloader_pin_memory=False,
            fp16=torch.cuda.is_available(),  # Enable mixed precision on GPU
        )
        
        # Initialize trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            compute_metrics=self.compute_metrics,
        )
        
        # Train the model
        print("Training started...")
        train_result = trainer.train()
        
        print("Training completed!")
        print(f"Training loss: {train_result.training_loss:.4f}")
        
        # Evaluate the model
        print("Evaluating model...")
        eval_result = trainer.evaluate()
        
        print("Evaluation results:")
        for key, value in eval_result.items():
            if key.startswith('eval_'):
                print(f"  {key}: {value:.4f}")
        
        return trainer, eval_result
    
    def save_model(self, trainer, save_directory: str):
        """
        Save the trained model and tokenizer
        
        Args:
            trainer: Trained Hugging Face trainer
            save_directory: Directory to save the model
        """
        print(f"Saving model to {save_directory}...")
        
        # Create directory if it doesn't exist
        os.makedirs(save_directory, exist_ok=True)
        
        # Save model and tokenizer
        trainer.save_model(save_directory)
        self.tokenizer.save_pretrained(save_directory)
        
        # Save label mapping and configuration
        metadata = {
            'label_mapping': self.label_mapping,
            'config': self.config,
            'num_labels': len(self.label_mapping),
            'categories': list(self.label_mapping.keys())
        }
        
        with open(os.path.join(save_directory, 'metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Model saved successfully to {save_directory}")
        print("Files saved:")
        for file in os.listdir(save_directory):
            print(f"  - {file}")

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
    try:
        # Load metadata
        with open(os.path.join(model_path, 'metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        label_mapping = metadata['label_mapping']
        reverse_mapping = {v: k for k, v in label_mapping.items()}
        
        # Load model and tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForSequenceClassification.from_pretrained(model_path)
        
        # Prepare input text
        full_text = f"{subject} {body}".strip()
        
        # Tokenize input
        inputs = tokenizer(
            full_text,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors='pt'
        )
        
        # Get predictions
        model.eval()
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
        
        # Apply sigmoid to get probabilities
        probabilities = torch.sigmoid(logits).squeeze().numpy()
        
        # Get top 2 categories
        top_indices = np.argsort(probabilities)[::-1][:2]
        top_categories = [reverse_mapping[idx] for idx in top_indices]
        top_confidences = [float(probabilities[idx]) for idx in top_indices]
        
        # Create result
        result = {
            'input_text': full_text,
            'top_2_categories': top_categories,
            'confidences': top_confidences,
            'predictions': [
                {
                    'category': top_categories[0],
                    'confidence': top_confidences[0]
                },
                {
                    'category': top_categories[1],
                    'confidence': top_confidences[1]
                }
            ],
            'all_probabilities': {reverse_mapping[i]: float(probabilities[i]) for i in range(len(probabilities))}
        }
        
        return result
        
    except Exception as e:
        return {
            'error': str(e),
            'input_text': f"{subject} {body}".strip(),
            'top_2_categories': ['error', 'error'],
            'confidences': [0.0, 0.0]
        }

def main():
    """
    Main training pipeline
    """
    print("=" * 60)
    print("EMAIL CLASSIFICATION MODEL TRAINING PIPELINE")
    print("=" * 60)
    
    # Initialize trainer
    trainer = EmailClassificationTrainer(CONFIG)
    
    # Load and preprocess data
    csv_path = "finalFile.csv"  # Update this path as needed
    texts, labels = trainer.load_and_preprocess_data(csv_path)
    
    # Create model and tokenizer
    num_labels = labels.shape[1]
    trainer.create_model_and_tokenizer(num_labels)
    
    # Train the model
    trained_model, eval_results = trainer.train_model(texts, labels)
    
    # Save the model
    trainer.save_model(trained_model, CONFIG['save_directory'])
    
    print("\n" + "=" * 60)
    print("TRAINING COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    
    # Demonstrate inference
    print("\nTesting inference with example email...")
    
    test_subject = "Invitation to Machine Learning Workshop"
    test_body = "Dear Students, we are organizing a workshop on machine learning next week. Please register by Friday."
    
    result = predict_email_categories(test_subject, test_body, CONFIG['save_directory'])
    
    if 'error' not in result:
        print(f"\nExample Prediction:")
        print(f"Subject: {test_subject}")
        print(f"Body: {test_body[:100]}...")
        print(f"Top categories:")
        for i, pred in enumerate(result['predictions'], 1):
            print(f"  {i}. {pred['category']} (confidence: {pred['confidence']:.3f})")
    else:
        print(f"Error in prediction: {result['error']}")
    
    print(f"\nModel and tokenizer saved to: {CONFIG['save_directory']}")
    print("You can now use the predict_email_categories() function for inference!")

if __name__ == "__main__":
    main()
