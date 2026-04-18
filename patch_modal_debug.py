import re

with open("frontend/src/components/data-coverage-modal.tsx", "r") as f:
    text = f.read()

old_use_effect = """  useEffect(() => {
    if (open && !data) {
      fetchCoverage(params)
        .then(setData)
        .catch(() => setData(null));
    }
  }, [open, data, params]);"""

new_use_effect = """  useEffect(() => {
    if (open && !data) {
      fetchCoverage(params)
        .then(setData)
        .catch((e) => {
          console.error("fetchCoverage failed", e);
          setData(null);
        });
    }
  }, [open, data, params]);"""

text = text.replace(old_use_effect, new_use_effect)

with open("frontend/src/components/data-coverage-modal.tsx", "w") as f:
    f.write(text)
