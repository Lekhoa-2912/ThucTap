import os
import re

router_dir = os.path.join("app", "routers")

for file in os.listdir(router_dir):
    if not file.endswith(".py"):
        continue
    
    filepath = os.path.join(router_dir, file)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    modified = False
    
    # Replace List[dict]
    if "List[dict]" in content:
        content = content.replace("List[dict]", "List[Dict[str, Any]]")
        modified = True
        
    # Replace dict
    if "response_model=dict" in content:
        content = content.replace("response_model=dict", "response_model=Dict[str, Any]")
        modified = True

    # Replace list
    if "response_model=list" in content:
        content = content.replace("response_model=list", "response_model=List[Any]")
        modified = True
        
    if modified:
        print(f"Modifying {file}...")
        # Ensure imports exist
        if "from typing import" in content:
            if "Dict" not in content:
                content = content.replace("from typing import ", "from typing import Dict, Any, ", 1)
            elif "Any" not in content:
                content = content.replace("from typing import Dict", "from typing import Dict, Any", 1)
        else:
            content = "from typing import Dict, Any, List\n" + content
            
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

print("Done.")
