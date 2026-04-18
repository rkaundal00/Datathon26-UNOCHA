import httpx
try:
    r = httpx.get("http://127.0.0.1:8000/api/coverage?analysis_year=2025&pin_floor=1000000&require_hrp=true&mode=combined&sort=gap_score&sort_dir=desc")
    print(r.status_code)
    print(r.text[:500])
except Exception as e:
    print(e)
