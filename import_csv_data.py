#!/usr/bin/env python3
import csv
import json
import sqlite3
import re
import sys
from pathlib import Path

def clean_preference_value(value):
    if not value or value.strip() == '':
        return None
    match = re.search(r'^(\d+)', value.strip())
    if match:
        return int(match.group(1))
    return None

def clean_experience_value(value):
    if not value or value.strip() == '':
        return 'Beginner'
    value = value.strip().lower()
    if 'advanced' in value:
        return 'Advanced'
    elif 'intermediate' in value:
        return 'Intermediate'
    else:
        return 'Beginner'

def clean_skills_value(value):
    if not value or value.strip() == '' or value.strip().lower() in ['none', 'n/a', 'no']:
        return '[]'
    skills = [skill.strip() for skill in value.split(',') if skill.strip()] #json arr format
    return json.dumps(skills)

def extract_net_id(email):
    if '@' in email:
        return email.split('@')[0]
    return email

def determine_hacker_type(is_first_time):
    if is_first_time.strip().lower() == 'yes':
        return 'FirstTimeHacker'
    else:
        return 'VeteranHacker'

def import_csv_to_database(csv_file_path, db_path):
    """Import CSV data into SQLite database, handling duplicates by keeping most recent submission"""
    from datetime import datetime

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    success_count = 0
    error_count = 0
    duplicate_count = 0

    try:
        # First pass: read all data and deduplicate by email
        participants_data = {}

        with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)

            for row_num, row in enumerate(reader, start=2):
                try:
                    email = row['Email Address'].strip()
                    timestamp_str = row['Timestamp'].strip()

                    # Parse timestamp - format: "9/10/2025 14:36:15"
                    timestamp = datetime.strptime(timestamp_str, '%m/%d/%Y %H:%M:%S')

                    # If this email already exists, only keep if this submission is more recent
                    if email in participants_data:
                        existing_timestamp = participants_data[email]['timestamp']
                        if timestamp <= existing_timestamp:
                            duplicate_count += 1
                            continue  # Skip this older submission
                        else:
                            duplicate_count += 1  # Count the older one we're replacing

                    # Store the participant data with timestamp
                    participants_data[email] = {
                        'row': row,
                        'row_num': row_num,
                        'timestamp': timestamp
                    }

                except Exception as e:
                    print(f"Error parsing row {row_num}: {e}")
                    error_count += 1
                    continue

        # Second pass: process the deduplicated data
        for email, data in participants_data.items():
            row = data['row']
            row_num = data['row_num']

            try:
                email = row['Email Address'].strip()
                full_name = row['Full Name'].strip()
                net_id = extract_net_id(email)
                frontend_exp = clean_experience_value(row['How would you define your technical skills and experience? [Frontend]'])
                backend_exp = clean_experience_value(row['How would you define your technical skills and experience? [Backend]'])
                design_exp = clean_experience_value(row['How would you define your technical skills and experience? [Design]'])
                hardware_exp = clean_experience_value(row['How would you define your technical skills and experience? [Hardware]'])
                frontend_pref = clean_preference_value(row['What is your preferred role in a team? [Frontend]'])
                backend_pref = clean_preference_value(row['What is your preferred role in a team? [Backend]'])
                design_pref = clean_preference_value(row['What is your preferred role in a team? [Design]'])
                hardware_pref = clean_preference_value(row['What is your preferred role in a team? [Hardware]'])
                any_role_pref = clean_preference_value(row['What is your preferred role in a team? [Any]'])
                backend_skills = clean_skills_value(row['Could you name any backend skills you possess like specific programming languages, technologies, etc? (NOTE: separate skills with commas. Example: "Express, Flask, Django, Spring Boot, Firebase")'])
                frontend_skills = clean_skills_value(row['Could you name any frontend skills you possess like specific programming languages, technologies, etc? (NOTE: separate skills with commas. Example: "React, Next.JS, Tailwind, Angular")'])
                design_skills = clean_skills_value(row['Could you name any design skills you possess like specific programming languages, technologies, etc? (NOTE: separate skills with commas. Example: "Figma, Canva, Adobe, Blender, Unity")'])
                hardware_skills = '[]'  # No hardware skills column in CSV
                hacker_type = determine_hacker_type(row['Are you a first time hacker? (This means this is your first hackathon)'])

                if any(pref is None for pref in [frontend_pref, backend_pref, design_pref, hardware_pref, any_role_pref]):
                    print(f"Warning: Row {row_num} has invalid preference values, skipping")
                    error_count += 1
                    continue

                cursor.execute('''
                    INSERT OR REPLACE INTO participants (
                        email, fullName, netId,
                        frontendExperience, backendExperience, designExperience, hardwareExperience,
                        frontendPreference, backendPreference, designPreference, hardwarePreference, anyRolePreference,
                        frontendSkills, backendSkills, designSkills, hardwareSkills,
                        hackerType, poolId
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    email, full_name, net_id,
                    frontend_exp, backend_exp, design_exp, hardware_exp,
                    frontend_pref, backend_pref, design_pref, hardware_pref, any_role_pref,
                    frontend_skills, backend_skills, design_skills, hardware_skills,
                    hacker_type, 'default'
                ))
                success_count += 1

            except Exception as e:
                print(f"Error processing row {row_num}: {e}")
                print(f"Row data: {row}")
                error_count += 1
                continue
        conn.commit()

        print(f"\nImport completed:")
        print(f"Successfully imported: {success_count} participants")
        print(f"Duplicate submissions (older versions skipped): {duplicate_count}")
        print(f"Errors encountered: {error_count}")
        cursor.execute("SELECT COUNT(*) FROM participants")
        total_participants = cursor.fetchone()[0]
        print(f"Total participants in database: {total_participants}")

    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_file_path}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        conn.close()
    return True

if __name__ == "__main__":
    csv_file = "/Users/rxue/Downloads/BigRed__Hacks Fall 2025 Team Matching (Responses) - Form Responses 1.csv"
    db_file = "backend/database.sqlite"
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    if len(sys.argv) > 2:
        db_file = sys.argv[2]
    print(f"Importing CSV data from: {csv_file}")
    print(f"Into database: {db_file}")
    if not Path(csv_file).exists():
        print(f"Error: CSV file does not exist: {csv_file}")
        sys.exit(1)
    if not Path(db_file).exists():
        print(f"Error: Database file does not exist: {db_file}")
        sys.exit(1)
    success = import_csv_to_database(csv_file, db_file)
    if success:
        print("\nData import completed successfully!")
        print("You can now use this data for team formation.")
    else:
        print("\nData import failed!")
        sys.exit(1)