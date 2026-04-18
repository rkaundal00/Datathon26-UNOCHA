import re

with open("frontend/src/components/data-coverage-modal.tsx", "r") as f:
    text = f.read()

text = text.replace("  }, [open, data, params]);\n", "  }, [open, params]);\n")

with open("frontend/src/components/data-coverage-modal.tsx", "w") as f:
    f.write(text)
