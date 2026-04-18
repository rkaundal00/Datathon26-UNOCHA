import subprocess
import time
import requests

proc = subprocess.Popen(["npm", "run", "start", "--prefix", "frontend"])
time.sleep(4)
try:
    r = requests.get("http://localhost:3000/")
    print("UI length:", len(r.text))
except Exception as e:
    print(e)
proc.terminate()
