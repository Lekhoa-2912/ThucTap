import os
import re

TARGET_DIR = r"D:\DU_AN\GoodZWork\Backend\app\routers"

def main():
    for root, dirs, files in os.walk(TARGET_DIR):
        for f in files:
            if not f.endswith(".py"):
                continue
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            
            original_content = content
            # Remove : dict
            content = re.sub(r"current_user:\s*dict\s*=\s*Depends", r"current_user = Depends", content)
            # Also replace in function signature lines if wrapped differently
            
            if content != original_content:
                with open(path, "w", encoding="utf-8") as file:
                    file.write(content)
                print(f"Fixed: {path}")

if __name__ == "__main__":
    main()
