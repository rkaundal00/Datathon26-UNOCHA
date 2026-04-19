"""QA-flag assembly for country rows."""
from __future__ import annotations

from pipeline.config import POPULATION_STALE_GAP


def build_flags(
    *,
    analysis_year: int,
    hno_row_year: int | None,
    population_reference_year: int | None,
    requirements_usd: float | None,
    funding_usd: float | None,
    donor_concentration: float | None,
    hrp_status: str,
    inform_severity: float | None,
    cluster_taxonomy_mismatch: bool = False,
    fts_year_fallback: bool = False,
    extra_flags: list[str] | None = None,
) -> list[str]:
    """Return the sorted list of QA flag strings for a country row.

    Canonical enum (see pipeline/api/schemas.py QAFlag):
      funding_imputed_zero, hno_stale, population_stale, donor_conc_2026_only,
      cluster_taxonomy_mismatch, severity_unavailable, preliminary_hno, hrp_status_unknown
    """
    flags: list[str] = []
    if inform_severity is None:
        flags.append("severity_unavailable")

    if (requirements_usd or 0) > 0 and not (funding_usd and funding_usd > 0):
        flags.append("funding_imputed_zero")

    if hno_row_year is not None and hno_row_year != analysis_year:
        flags.append("hno_stale")

    if (
        population_reference_year is not None
        and analysis_year - population_reference_year > POPULATION_STALE_GAP
    ):
        flags.append("population_stale")

    if donor_concentration is not None:
        flags.append("donor_conc_2026_only")

    if cluster_taxonomy_mismatch:
        flags.append("cluster_taxonomy_mismatch")

    if analysis_year == 2026:
        flags.append("preliminary_hno")

    if hrp_status == "Unknown":
        flags.append("hrp_status_unknown")

    if fts_year_fallback:
        flags.append("fts_year_fallback")

    if extra_flags:
        for f in extra_flags:
            if f not in flags:
                flags.append(f)

    return sorted(flags)
