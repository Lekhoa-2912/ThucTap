import os
import re

TARGET_DIR = r"D:\DU_AN\GoodZWork\Backend\app\routers"

# Regex modes we want to remove from response_model=...
patterns = [
    r",\s*response_model\s*=\s*Dict\[str,\s*Any\]",
    r",\s*response_model\s*=\s*List\[Dict\[str,\s*Any\]\]",
    r",\s*response_model\s*=\s*dict",
    r",\s*response_model\s*=\s*list",
    r",\s*response_model\s*=\s*List\[dict\]",
    r",\s*response_model\s*=\s*List\[Any\]",
    r",\s*response_model\s*=\s*Any",
]

def main():
    for root, dirs, files in os.walk(TARGET_DIR):
        for f in files:
            if not f.endswith(".py"):
                continue
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            
            original_content = content
            for pat in patterns:
                content = re.sub(pat, "", content)
            
            if content != original_content:
                with open(path, "w", encoding="utf-8") as file:
                    file.write(content)
                print(f"Fixed: {path}")

if __name__ == "__main__":
    main()
