with open("frontend/src/components/data-coverage-modal.tsx", "r") as f:
    text = f.read()

old_import = 'import { numCompact } from "@/lib/formatters";'
new_import = 'import { numCompact, usdCompact, percent } from "@/lib/formatters";'

old_block = """                  <div className="flex gap-2 text-[11px] text-text-muted mt-0.5">
                    <span title="People in Need">
                      PIN: <span className="text-text">{r.pin != null ? numCompact(r.pin) : "—"}</span>
                    </span>
                    <span title="Funding Requirements">
                      Reqs: <span className="text-text">{r.requirements_usd ? "$" + numCompact(r.requirements_usd) : "—"}</span>
                    </span>
                  </div>"""

new_block = """                  <div className="flex gap-2 text-[11px] text-text-muted mt-0.5">
                    <span title="People in Need">
                      PIN: <span className="text-text">{r.pin != null ? numCompact(r.pin) : "—"}</span>
                    </span>
                    <span title="Funding Requirements">
                      Reqs: <span className="text-text">{r.requirements_usd != null ? usdCompact(r.requirements_usd) : "—"}</span>
                    </span>
                    <span title="Funding Coverage">
                      Cov: <span className="text-text">{r.coverage_ratio != null ? percent(r.coverage_ratio) : "—"}</span>
                    </span>
                  </div>"""

text = text.replace(old_import, new_import)
text = text.replace(old_block, new_block)

with open("frontend/src/components/data-coverage-modal.tsx", "w") as f:
    f.write(text)
