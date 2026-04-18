import urllib.request
import traceback

try:
    with urllib.request.urlopen("http://localhost:3000") as response:
        html = response.read().decode('utf-8')
        print(html[:500])
except Exception as e:
    traceback.print_exc()
