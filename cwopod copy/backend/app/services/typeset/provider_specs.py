"""Print provider page specifications for typesetting."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderSpec:
    """Print provider page specifications."""

    name: str
    trim_width: float  # inches
    trim_height: float  # inches
    margin_top: float  # inches
    margin_bottom: float  # inches
    margin_outer: float  # inches
    gutter: float  # inches (inner margin for binding)
    bleed: float  # inches
    min_page_count: int
    max_page_count: int


PROVIDER_SPECS: dict[str, ProviderSpec] = {
    "lulu": ProviderSpec(
        name="Lulu xPress",
        trim_width=5.5,
        trim_height=8.5,
        margin_top=0.75,
        margin_bottom=0.75,
        margin_outer=0.75,
        gutter=0.875,
        bleed=0.125,
        min_page_count=32,
        max_page_count=800,
    ),
    "bookvault": ProviderSpec(
        name="BookVault",
        trim_width=5.06,
        trim_height=7.81,
        margin_top=0.7,
        margin_bottom=0.7,
        margin_outer=0.7,
        gutter=0.8,
        bleed=0.118,
        min_page_count=24,
        max_page_count=600,
    ),
    "kdp": ProviderSpec(
        name="KDP Print",
        trim_width=5.5,
        trim_height=8.5,
        margin_top=0.75,
        margin_bottom=0.75,
        margin_outer=0.75,
        gutter=0.875,
        bleed=0.125,
        min_page_count=24,
        max_page_count=828,
    ),
}


# Page count limits by provider and binding type: (min_pages, max_pages)
# These reflect real provider constraints — exceeding them will cause order rejection.
PAGE_COUNT_LIMITS: dict[str, dict[str, tuple[int, int]]] = {
    "lulu": {
        "paperback": (32, 800),
        "hardback": (32, 800),
        "micro": (32, 800),
    },
    "bookvault": {
        "paperback": (24, 600),
        "hardback": (24, 400),
        "micro": (24, 400),
    },
    "kdp": {
        "paperback": (24, 828),
        "hardback": (75, 550),
        "micro": (75, 550),
    },
}


def get_page_count_limits(provider: str, binding_type: str) -> tuple[int, int]:
    """Get (min_pages, max_pages) for a provider + binding combination.

    Returns the limits tuple, or falls back to the provider's general spec limits.
    """
    provider_limits = PAGE_COUNT_LIMITS.get(provider)
    if provider_limits:
        limits = provider_limits.get(binding_type)
        if limits:
            return limits
    # Fallback to general provider spec
    spec = PROVIDER_SPECS.get(provider)
    if spec:
        return (spec.min_page_count, spec.max_page_count)
    return (24, 800)


def validate_page_count(page_count: int, provider: str, binding_type: str) -> dict | None:
    """Validate page count against provider+binding limits.

    Returns None if valid, or a dict with error details if invalid:
    {
        "allowed": False,
        "min_pages": int,
        "max_pages": int,
        "message": str,
    }
    """
    min_pages, max_pages = get_page_count_limits(provider, binding_type)

    if page_count < min_pages:
        return {
            "allowed": False,
            "min_pages": min_pages,
            "max_pages": max_pages,
            "message": f"This book has {page_count} pages, but {provider.title()} requires at least {min_pages} pages for {binding_type} binding.",
        }

    if page_count > max_pages:
        return {
            "allowed": False,
            "min_pages": min_pages,
            "max_pages": max_pages,
            "message": f"This book has {page_count} pages, but {provider.title()} allows a maximum of {max_pages} pages for {binding_type} binding. Reduce font size, choose a larger trim size, or switch to a different provider.",
        }

    return None


def get_provider_spec(provider: str) -> ProviderSpec:
    """Get the ProviderSpec for the given provider key."""
    if provider not in PROVIDER_SPECS:
        raise ValueError(
            f"Unknown provider '{provider}'. Supported: {', '.join(PROVIDER_SPECS.keys())}"
        )
    return PROVIDER_SPECS[provider]
