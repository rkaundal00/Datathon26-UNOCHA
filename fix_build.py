import re

# Fix page.tsx
with open("frontend/src/app/page.tsx", "r") as f:
    text = f.read()
text = text.replace(
    '<ScatterPanels rows={ranking.rows} active={urlState.scatter} focusIso={focusIso} />',
    '<ScatterPanels rows={ranking.rows} focusIso={focusIso} />'
)
with open("frontend/src/app/page.tsx", "w") as f:
    f.write(text)

# Fix scatter-panels.tsx
with open("frontend/src/components/scatter-panels.tsx", "r") as f:
    text = f.read()

text = text.replace("onClick={() => p.payload?.iso3 && onClickPoint(p.payload.iso3)}", "onClick={() => p.payload?.iso3 && clickPoint(p.payload.iso3)}")

with open("frontend/src/components/scatter-panels.tsx", "w") as f:
    f.write(text)
