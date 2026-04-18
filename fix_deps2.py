import re

with open("frontend/src/components/data-coverage-modal.tsx", "r") as f:
    text = f.read()

old_block = """  useEffect(() => {
    if (open && !data) {
      fetchCoverage(params)
        .then(setData)
        .catch((e) => {
          console.error("fetchCoverage failed", e);
          setData(null);
        });
    }
  }, [open, params]);"""

new_block = """  // Stringify params strictly for the dependency array to avoid infinite loops across re-renders
  const paramsKey = JSON.stringify(params);
  
  useEffect(() => {
    if (!open) return;
    
    // We fetch whenever the modal opens or params meaningfully change.
    // If we already have data, we might not refetch unless params changed since last time,
    // but the simplest safe fix is refetching unconditionally on param change IF open.
    fetchCoverage(params)
      .then(setData)
      .catch((e) => {
        console.error("fetchCoverage failed", e);
        setData(null);
      });
  }, [open, paramsKey]);"""

text = text.replace(old_block, new_block)

with open("frontend/src/components/data-coverage-modal.tsx", "w") as f:
    f.write(text)
