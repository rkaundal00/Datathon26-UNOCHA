import re

with open("frontend/src/components/country-table.tsx", "r") as f:
    text = f.read()

text = text.replace('import { Fragment, useState } from "react";', 'import { Fragment } from "react";')
text = text.replace('  const [expanded, setExpanded] = useState<string | null>(null);\n', '')
text = text.replace('              const isOpen = expanded === row.iso3;\n', '')

old_td = """                  <td
                    className="px-3 py-2 text-right"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(isOpen ? null : row.iso3);
                    }}
                  >"""
new_td = '                  <td className="px-3 py-2 text-right">'
text = text.replace(old_td, new_td)

# remove the isOpen block entirely
text = re.sub(r'\s*\{isOpen && \(\s*<tr className="bg-surface-2/60">.*?\n\s*\)\}', '', text, flags=re.DOTALL)

with open("frontend/src/components/country-table.tsx", "w") as f:
    f.write(text)

