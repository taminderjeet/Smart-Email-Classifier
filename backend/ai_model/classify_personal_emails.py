"""
Personal Email Classification Tool
=================================

This script allows you to classify your personal emails using the trained model.
You can either input emails manually or load them from a CSV file.

Usage:
    python classify_personal_emails.py
"""

import os
import pandas as pd
from inference import EmailClassifier
from typing import List, Dict, Any

def classify_single_email():
    """
    Classify a single email by manual input
    """
    print("\n" + "="*50)
    print("SINGLE EMAIL CLASSIFICATION")
    print("="*50)
    
    # Get email input from user
    print("Enter your email details:")
    subject = input("Subject: ").strip()
    print("Body (press Enter twice when done):")
    
    body_lines = []
    while True:
        line = input()
        if line == "" and len(body_lines) > 0 and body_lines[-1] == "":
            break
        body_lines.append(line)
    
    body = "\n".join(body_lines).strip()
    
    if not subject and not body:
        print("No email content provided!")
        return
    
    # Load classifier and predict
    try:
        classifier = EmailClassifier("./email_classification_model")
        result = classifier.predict(subject, body)
        
        if result['success']:
            print(f"\n📧 EMAIL CLASSIFICATION RESULTS:")
            print(f"Subject: {subject}")
            print(f"Body: {body[:100]}{'...' if len(body) > 100 else ''}")
            print(f"\n🏷️  TOP CATEGORIES:")
            
            for i, pred in enumerate(result['predictions'], 1):
                confidence_bar = "█" * int(pred['confidence'] * 20)
                print(f"  {i}. {pred['category'].upper()}")
                print(f"     Confidence: {pred['confidence']:.1%} {confidence_bar}")
            
            print(f"\n📊 ALL CATEGORY PROBABILITIES:")
            all_probs = classifier.get_category_probabilities(subject, body)
            
            # Show top 8 categories
            for i, (category, prob) in enumerate(list(all_probs.items())[:8], 1):
                bar = "▓" * int(prob * 30)
                print(f"  {i:2d}. {category:25} {prob:.1%} {bar}")
            
            if len(all_probs) > 8:
                print(f"     ... and {len(all_probs) - 8} more categories")
                
        else:
            print(f"❌ Error in classification: {result['error']}")
            
    except Exception as e:
        print(f"❌ Error loading model: {str(e)}")
        print("Make sure the model is trained and saved in ./email_classification_model/")

def classify_from_csv():
    """
    Classify emails from a CSV file
    """
    print("\n" + "="*50)
    print("BATCH EMAIL CLASSIFICATION FROM CSV")
    print("="*50)
    
    # Get CSV file path
    csv_path = input("Enter path to your CSV file (or press Enter for default 'my_emails.csv'): ").strip()
    if not csv_path:
        csv_path = "my_emails.csv"
    
    if not os.path.exists(csv_path):
        print(f"❌ File not found: {csv_path}")
        print("\nYour CSV should have columns: subject, body")
        print("Example format:")
        print("subject,body")
        print("\"Meeting reminder\",\"Don't forget our meeting at 3 PM\"")
        print("\"Sale notification\",\"50% off all products today only!\"")
        return
    
    try:
        # Load CSV
        df = pd.read_csv(csv_path)
        print(f"📁 Loaded {len(df)} emails from {csv_path}")
        
        # Check required columns
        if 'subject' not in df.columns:
            print("❌ Missing 'subject' column in CSV")
            return
        if 'body' not in df.columns:
            print("❌ Missing 'body' column in CSV")
            return
        
        # Load classifier
        classifier = EmailClassifier("./email_classification_model")
        
        # Prepare emails for batch processing
        emails = []
        for _, row in df.iterrows():
            emails.append({
                'subject': str(row['subject']) if pd.notna(row['subject']) else '',
                'body': str(row['body']) if pd.notna(row['body']) else ''
            })
        
        print(f"🔄 Classifying {len(emails)} emails...")
        
        # Batch prediction
        results = classifier.predict_batch(emails)
        
        # Process results
        classified_data = []
        for i, (email, result) in enumerate(zip(emails, results)):
            if result['success']:
                row_data = {
                    'email_id': i + 1,
                    'subject': email['subject'],
                    'body': email['body'][:200] + '...' if len(email['body']) > 200 else email['body'],
                    'category_1': result['predictions'][0]['category'] if len(result['predictions']) > 0 else 'unknown',
                    'confidence_1': result['predictions'][0]['confidence'] if len(result['predictions']) > 0 else 0.0,
                    'category_2': result['predictions'][1]['category'] if len(result['predictions']) > 1 else 'unknown',
                    'confidence_2': result['predictions'][1]['confidence'] if len(result['predictions']) > 1 else 0.0,
                }
            else:
                row_data = {
                    'email_id': i + 1,
                    'subject': email['subject'],
                    'body': email['body'][:200] + '...' if len(email['body']) > 200 else email['body'],
                    'category_1': 'error',
                    'confidence_1': 0.0,
                    'category_2': 'error',
                    'confidence_2': 0.0,
                }
            classified_data.append(row_data)
        
        # Create results DataFrame
        results_df = pd.DataFrame(classified_data)
        
        # Save results
        output_path = f"classified_{os.path.basename(csv_path)}"
        results_df.to_csv(output_path, index=False)
        
        print(f"✅ Classification completed!")
        print(f"📄 Results saved to: {output_path}")
        
        # Show summary
        print(f"\n📊 CLASSIFICATION SUMMARY:")
        category_counts = results_df['category_1'].value_counts()
        print(f"Most common categories:")
        for i, (category, count) in enumerate(category_counts.head(10).items(), 1):
            print(f"  {i:2d}. {category:25} ({count} emails)")
        
        # Show some examples
        print(f"\n📧 SAMPLE RESULTS:")
        for i in range(min(5, len(results_df))):
            row = results_df.iloc[i]
            print(f"\nEmail {i+1}:")
            print(f"  Subject: {row['subject']}")
            print(f"  Top category: {row['category_1']} ({row['confidence_1']:.1%})")
            print(f"  2nd category: {row['category_2']} ({row['confidence_2']:.1%})")
        
    except Exception as e:
        print(f"❌ Error processing CSV: {str(e)}")

def classify_from_text_input():
    """
    Classify multiple emails from text input
    """
    print("\n" + "="*50)
    print("MULTIPLE EMAIL CLASSIFICATION")
    print("="*50)
    
    print("Enter multiple emails (format: Subject | Body)")
    print("Press Enter twice when done with all emails")
    print("Example: Meeting reminder | Don't forget our meeting at 3 PM")
    print()
    
    emails = []
    while True:
        line = input(f"Email {len(emails)+1} (or press Enter to finish): ").strip()
        if not line:
            break
        
        if '|' in line:
            parts = line.split('|', 1)
            subject = parts[0].strip()
            body = parts[1].strip()
        else:
            subject = line
            body = ""
        
        emails.append({'subject': subject, 'body': body})
    
    if not emails:
        print("No emails provided!")
        return
    
    try:
        # Load classifier
        classifier = EmailClassifier("./email_classification_model")
        
        print(f"\n🔄 Classifying {len(emails)} emails...")
        
        # Classify emails
        results = classifier.predict_batch(emails)
        
        print(f"\n📧 CLASSIFICATION RESULTS:")
        print("="*60)
        
        for i, (email, result) in enumerate(zip(emails, results), 1):
            print(f"\nEmail {i}:")
            print(f"Subject: {email['subject']}")
            if email['body']:
                print(f"Body: {email['body'][:100]}{'...' if len(email['body']) > 100 else ''}")
            
            if result['success']:
                print(f"Categories:")
                for j, pred in enumerate(result['predictions'], 1):
                    print(f"  {j}. {pred['category'].upper()} ({pred['confidence']:.1%})")
            else:
                print(f"Error: {result['error']}")
            print("-" * 40)
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def create_sample_csv():
    """
    Create a sample CSV file for testing
    """
    sample_data = [
        {
            'subject': 'Team Meeting Tomorrow',
            'body': 'Reminder about our weekly team meeting scheduled for tomorrow at 2 PM in the conference room. Please bring your project updates.'
        },
        {
            'subject': 'Workshop on Machine Learning',
            'body': 'Join us for an exciting workshop on machine learning fundamentals. This session will cover basic concepts and hands-on exercises.'
        },
        {
            'subject': 'Internship Opportunity at Tech Corp',
            'body': 'We are pleased to offer you an internship position at our company. The role involves working on cutting-edge technology projects.'
        },
        {
            'subject': 'Exam Results Published',
            'body': 'Your semester exam results have been published. Please check the student portal for detailed scores and feedback.'
        },
        {
            'subject': 'Special Discount Offer',
            'body': 'Limited time offer! Get 50% off on all courses. Use code SAVE50 at checkout. Valid until this Friday.'
        }
    ]
    
    df = pd.DataFrame(sample_data)
    df.to_csv('sample_emails.csv', index=False)
    print("📄 Created sample_emails.csv with 5 example emails")
    print("You can use this file to test CSV classification!")

def show_available_categories():
    """
    Show all available categories from the trained model
    """
    try:
        classifier = EmailClassifier("./email_classification_model")
        categories = classifier.get_available_categories()
        
        print(f"\n📋 AVAILABLE CATEGORIES ({len(categories)} total):")
        print("="*50)
        
        for i, category in enumerate(categories, 1):
            print(f"  {i:2d}. {category}")
        
    except Exception as e:
        print(f"❌ Error loading categories: {str(e)}")

def main():
    """
    Main menu for personal email classification
    """
    print("🏷️  PERSONAL EMAIL CLASSIFIER")
    print("="*50)
    print("Using trained model from your finalFile.csv dataset")
    
    while True:
        print(f"\n📋 Choose an option:")
        print("1. Classify a single email (manual input)")
        print("2. Classify emails from CSV file")
        print("3. Classify multiple emails (text input)")
        print("4. Show available categories")
        print("5. Create sample CSV file")
        print("6. Exit")
        
        choice = input(f"\nEnter your choice (1-6): ").strip()
        
        if choice == '1':
            classify_single_email()
        elif choice == '2':
            classify_from_csv()
        elif choice == '3':
            classify_from_text_input()
        elif choice == '4':
            show_available_categories()
        elif choice == '5':
            create_sample_csv()
        elif choice == '6':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please enter 1-6.")

if __name__ == "__main__":
    main()
