import os
import subprocess
import re

def install_with_auto_unpin():
    req_file = "requirements.txt"
    while True:
        cmd = ["python", "-m", "pip", "install", "-r", req_file, "--no-cache-dir"]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        out = result.stdout + result.stderr
        
        if result.returncode == 0:
            print("Successfully installed all requirements.")
            break
        
        # Look for "No matching distribution found for <pkg>"
        match = re.search(r"No matching distribution found for ([^\s=]+)", out)
        if match:
            pkg = match.group(1).lower()
            print(f"Unpinning: {pkg}")
            
            with open(req_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
            with open(req_file, "w", encoding="utf-8") as f:
                for line in lines:
                    if line.lower().startswith(f"{pkg}=="):
                        f.write(f"{pkg}\n")
                    elif f"No matching distribution found for {pkg}" in out and line.strip().lower() == pkg:
                        # Maybe it is totally nonexistent
                        print(f"Skipping {pkg} completely as it still fails without pin")
                    else:
                        f.write(line)
            continue
            
        print("Installation failed for some other reason:\n", out)
        break

if __name__ == "__main__":
    install_with_auto_unpin()
