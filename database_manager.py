import json
import os

class DatabaseManager:
    def __init__(self, db_path="criteria.json"):
        self.db_path = db_path
        self.data = self._load_data()

    def _load_data(self):
        # 1. Check if the file exists to prevent unexpected crashes
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database file not found: {self.db_path}")
        
        # 2. Read the file with protection against JSON formatting errors
        try:
            with open(self.db_path, 'r', encoding='utf-8') as file:
                return json.load(file)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON format error (e.g., missing comma or bracket). Details: {e}")

    def get_skill(self, skill_id):
        """Returns the criteria for a specific skill based on its ID"""
        skills = self.data.get("skills", {})
        if skill_id in skills:
            return skills[skill_id]
        raise ValueError(f"Skill '{skill_id}' not found in the database.")

    def get_all_skills(self):
        """Returns a dictionary of all skills (useful for rendering UI buttons)"""
        return self.data.get("skills", {})

# ==========================================
# Testing Area
# ==========================================
if __name__ == "__main__":
    db = DatabaseManager()
    
    # Test retrieving a single skill
    cpr_skill = db.get_skill("cpr")
    print(f"Loaded Skill: {cpr_skill['name']}")
    print(f"Target Rate (BPM): {cpr_skill['primary_metric']['target_min']} - {cpr_skill['primary_metric']['target_max']}")
    
    print("-" * 30)
    
    # Test retrieving all skills
    all_skills = db.get_all_skills()
    print(f"Total entries found: {len(all_skills)}")
    
    for key, val in all_skills.items():
        # Ignore the dummy keys used for JSON comments
        if not key.startswith("_comment"):
            print(f" - {val['name']} ({val['category']})")