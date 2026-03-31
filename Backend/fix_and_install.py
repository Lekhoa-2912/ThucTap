import os
import sys
import subprocess
import re

def fix_and_install():
    req_file = "requirements.txt"
    with open(req_file, "r", encoding="utf-16le") as f:
        lines = f.readlines()
    
    with open(req_file, "w", encoding="utf-16le") as f:
        for line in lines:
            if "yt-dlp @" in line:
                f.write("yt-dlp\n")
            elif "yt-dlp-ejs" in line:
                continue
            elif "absl-py" in line:
                f.write("absl-py==2.1.0\n")
            else:
                f.write(line)

    print("Fixed requirements format.")
    
    venv_python = os.path.join("venv", "Scripts", "python.exe")
    
    while True:
        cmd = [venv_python, "-m", "pip", "install", "-r", req_file, "--no-cache-dir"]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        out = result.stdout + result.stderr
        
        if result.returncode == 0:
            print("Successfully installed all requirements.")
            break
        
        match = re.search(r"No matching distribution found for ([^\s=]+)", out)
        if match:
            pkg = match.group(1).lower()
            print(f"Unpinning: {pkg}")
            
            with open(req_file, "r", encoding="utf-16le") as f:
                lines = f.readlines()
                
            with open(req_file, "w", encoding="utf-16le") as f:
                for line in lines:
                    if line.lower().startswith(f"{pkg}=="):
                        f.write(f"{pkg}\n")
                    elif f"No matching distribution found for {pkg}" in out and line.strip().lower() == pkg:
                        print(f"Skipping {pkg} completely as it still fails without pin")
                    else:
                        f.write(line)
            continue
            
        print("Installation failed for some other reason:\n", out)
        break

if __name__ == "__main__":
    fix_and_install()
