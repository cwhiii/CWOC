# Complete Function & Class Inventory

## Backend (Python)

### config.py
  4: class Settings(BaseSettings):

### database.py
  9: async def get_db() -> AsyncSession:

### main.py
  22: async def global_exception_handler(request: Request, exc: Exception):

### middleware/auth.py
  12: async def get_current_user(
  37: async def get_optional_user(

### models/ai_config.py
  10: class AIConfig(Base, TimestampMixin, UserScopedMixin):

### models/base.py
  9: class Base(DeclarativeBase):
  15: class TimestampMixin:
  26: class UserScopedMixin:

### models/correction.py
  11: class CorrectionStatus(str, PyEnum):
  17: class Correction(Base, TimestampMixin):

### models/cover.py
  10: class CoverPrompt(Base, TimestampMixin):
  24: class CoverLayout(Base, TimestampMixin):
  37: class CoverSession(Base, TimestampMixin):

### models/credentials.py
  10: class ProviderCredential(Base, TimestampMixin, UserScopedMixin):

### models/order.py
  11: class OrderStatus(str, PyEnum):
  20: class PrintOrder(Base, TimestampMixin, UserScopedMixin):
  35: class OrderItem(Base):

### models/project.py
  11: class SourceType(str, PyEnum):
  17: class ProjectStatus(str, PyEnum):
  26: class BookProject(Base, TimestampMixin, UserScopedMixin):

### models/user.py
  11: class User(Base, TimestampMixin):
  22: class Session(Base):

### models/user_preference.py
  13: class UserPreference(Base, TimestampMixin):

### routers/ai_config.py
  18: class AIConfigResponse(BaseModel):
  27: class AIConfigUpdate(BaseModel):
  37:     def validate_api_key(cls, v):
  47:     def validate_text_provider(cls, v):
  56:     def validate_image_provider(cls, v):
  65: async def get_ai_config(
  96: async def update_ai_config(

### routers/auth.py
  21: def _set_session_cookie(response: Response, token: str) -> None:
  36: def _clear_session_cookie(response: Response) -> None:
  47: async def register(
  76: async def login(
  105: async def logout(

### routers/bookshelf.py
  20: class SortOrderRequest(BaseModel):
  24: class BatchOrderRequest(BaseModel):
  32: async def list_bookshelf(
  86: async def update_sort_order(
  114: async def batch_order(

### routers/cover.py
  32: class AssembleRequest(BaseModel):
  38: async def generate_prompts(
  79: async def generate_blurb(
  106: async def assemble_cover(
  156: async def get_spine_width(
  169: class GenerateImageRequest(BaseModel):
  175: async def generate_image(
  265: async def upload_cover_image(
  301: async def serve_cover_image(
  325: async def get_templates(
  336: async def download_cover_pdf(
  360: async def _get_project(project_id: UUID, user_id: UUID, db: AsyncSession) -> BookProject:

### routers/health.py
  7: async def health_check():

### routers/print_orders.py
  28: class ShippingAddress(BaseModel):
  38: class PricingRequest(BaseModel):
  45:     def validate_provider(cls, v):
  51: class OrderCreateRequest(BaseModel):
  61:     def validate_provider(cls, v):
  67: class CredentialStoreRequest(BaseModel):
  73:     def validate_provider(cls, v):
  83: async def get_pricing(
  133: async def create_order(
  189: async def list_orders(
  219: async def get_order(
  258: async def store_credentials(
  291: async def list_credentials(
  311: async def delete_credentials(

### routers/projects.py
  23: class ImportRequest(BaseModel):
  29: async def list_projects(
  59: async def get_project(
  94: async def import_from_source(
  198: async def upload_document(

### routers/quality_controller.py
  20: class CorrectionOut(BaseModel):
  29: class CorrectionStatusUpdate(BaseModel):
  34: class CorrectionUpdateRequest(BaseModel):
  39: class ApplyResponse(BaseModel):
  46: async def start_typo_scan(
  82: async def list_corrections(
  121: async def update_corrections(
  175: async def apply_corrections(

### routers/search.py
  15: class SearchResultOut(BaseModel):
  27: class ProviderStatusOut(BaseModel):
  34: class SearchResponse(BaseModel):
  45: async def search_books(

### routers/typeset.py
  21: class TypesetRequest(BaseModel):
  26: async def start_typeset(
  54: async def download_interior_pdf(

### routers/user.py
  23: async def get_profile(
  36: async def update_profile(
  58: class PreferencesResponse(BaseModel):
  63: class PreferencesUpdateRequest(BaseModel):
  69: async def get_preferences(
  94: async def update_preferences(

### schemas/auth.py
  9: class RegisterRequest(BaseModel):
  14: class LoginRequest(BaseModel):
  19: class UserResponse(BaseModel):
  25: class UserProfileResponse(BaseModel):
  31: class ProfileUpdateRequest(BaseModel):

### services/ai_engine/base.py
  7: class AIProviderError(Exception):
  10:     def __init__(self, message: str, provider: str, is_timeout: bool = False):
  18: class AIResult:
  29: class AIProvider(ABC):
  33:     async def generate_text(
  44:     async def generate_image(

### services/ai_engine/providers/anthropic.py
  8: class AnthropicProvider(AIProvider):
  13:     def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
  17:     def _headers(self) -> dict:
  24:     async def generate_text(
  66:     async def generate_image(

### services/ai_engine/providers/comfyui.py
  11: class ComfyUIProvider(AIProvider):
  14:     def __init__(self, base_url: str = "http://comfyui:8188", model: str = "sd_xl_base_1.0"):
  18:     async def generate_text(
  23:     async def generate_image(
  71:     async def _poll_completion(
  91:     def _build_workflow(self, prompt: str, width: int, height: int) -> dict:

### services/ai_engine/providers/ollama.py
  8: class OllamaProvider(AIProvider):
  11:     def __init__(self, base_url: str = "http://ollama:11434", model: str = "llama3"):
  15:     async def generate_text(
  53:     async def generate_image(

### services/ai_engine/providers/openai.py
  8: class OpenAIProvider(AIProvider):
  13:     def __init__(self, api_key: str, text_model: str = "gpt-4o", image_model: str = "dall-e-3"):
  18:     def _headers(self) -> dict:
  24:     async def generate_text(
  65:     async def generate_image(

### services/ai_engine/providers/replicate.py
  10: class ReplicateProvider(AIProvider):
  15:     def __init__(self, api_key: str, model: str = "black-forest-labs/flux-1.1-pro"):
  19:     def _headers(self) -> dict:
  25:     async def generate_text(
  30:     async def generate_image(
  84:     async def _poll_prediction(self, client: httpx.AsyncClient, prediction_id: str) -> str:

### services/ai_engine/router.py
  20: class AIRouter:
  23:     def __init__(self, db: AsyncSession, user_id: UUID):
  27:     async def generate_text(
  78:     async def generate_image(
  129:     async def _get_config(self) -> AIConfig | None:
  136:     def _get_provider(self, task_type: str, config: AIConfig | None) -> AIProvider:
  173:     def _create_local_provider(self, task_type: str, model: str | None) -> AIProvider:
  190:     def _create_external_provider(
  227:     def _decrypt_key(self, encrypted_key: str | None) -> str:

### services/auth_service.py
  16: class AuthError(Exception):
  19:     def __init__(self, message: str):
  24: class AuthService:
  27:     def __init__(self, db: AsyncSession):
  30:     async def register(self, email: str, password: str) -> tuple[User, Session]:
  75:     async def login(self, email: str, password: str) -> tuple[User, Session]:
  107:     async def logout(self, session_token: str) -> None:
  113:     async def validate_session(self, session_token: str) -> User | None:
  147:     async def cleanup_expired_sessions(self) -> int:
  155:     async def _create_session(self, user_id: UUID) -> Session:

### services/cover/assembler.py
  31: class CoverValidationError(CoverServiceError):
  34:     def __init__(self, missing_elements: list[str]):
  40: class CoverAssembler:
  43:     def __init__(self):
  46:     def calculate_spine_width(self, page_count: int, paper_stock: str = "standard_white") -> float:
  66:     def validate_layout(self, layout: dict) -> list[str]:
  101:     async def assemble_cover(
  235:     def _draw_front_image(self, ctx, image_path: str, panel_x: float, bleed_pt: float, panel_w: float, panel_h: float):
  292:     def _draw_spine(self, ctx, layout: dict, spine_x: float, bleed_pt: float, spine_w: float, panel_h: float):
  342:     def _draw_back_cover(
  415:     def _generate_qr_code(self, url: str, output_dir: Path, filename: str = "qr.png") -> Optional[Path]:
  452:     def _draw_qr_on_context(self, ctx, qr_path: Path, x: float, y: float, size: float):
  486:     def _draw_text_overlay(
  528:     def _parse_color(color: str) -> tuple[float, float, float]:
  539:     def _write_placeholder_pdf(output_path: Path, width_mm: float, height_mm: float):

### services/cover/blurb_generator.py
  15: class BlurbGenerator:
  18:     def __init__(self, ai_router: AIRouter):
  21:     async def generate_blurb(self, book_text: str, title: str, author: str) -> str:
  45:     def validate_blurb_length(self, text: str) -> bool:

### services/cover/prompt_generator.py
  18: class CoverServiceError(Exception):
  19:     def __init__(self, message: str, can_retry: bool = True):
  25: class PromptGenerator:
  28:     def __init__(self, ai_router: AIRouter):
  31:     async def generate_prompts(self, book_text: str, title: str, author: str) -> list[str]:
  56:     def _parse_prompts(self, raw_response: str) -> list[str]:

### services/cover/templates.py
  15: class TextEffects:
  27: class TextStyle:
  38: class TextPosition:
  46: class CoverTemplate:
  251: def get_template(template_id: str) -> CoverTemplate:
  259: def list_templates() -> list[dict]:

### services/print_service/base.py
  11: class ProviderError(Exception):
  14:     def __init__(self, message: str, provider: str, is_retryable: bool = False):
  22: class PricingEstimate:
  34: class OrderSubmissionResult:
  44: class OrderStatusResult:
  55: class BookSpec:
  72: class PrintProviderAdapter(ABC):
  77:     def provider_name(self) -> str:
  82:     async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
  98:     async def submit_order(
  116:     async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:

### services/print_service/bookvault_adapter.py
  27: class BookVaultAdapter(PrintProviderAdapter):
  35:     def __init__(self, api_key: str):
  40:     def provider_name(self) -> str:
  43:     def _headers(self) -> dict:
  50:     def _build_product_spec(self, book_spec: BookSpec) -> dict:
  69:     async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
  147:     async def submit_order(
  242:     async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:

### services/print_service/credential_service.py
  16: class CredentialService:
  23:     def __init__(self, db: AsyncSession, user_id: UUID):
  29:     async def store_credentials(self, provider: str, credentials: dict) -> None:
  66:     async def get_credentials(self, provider: str) -> dict | None:
  100:     async def delete_credentials(self, provider: str) -> None:
  115:     async def list_configured_providers(self) -> list[str]:

### services/print_service/isbn.py
  8: class ISBNManager:
  17:     def validate_isbn13(self, isbn: str) -> tuple[bool, str | None]:
  50:     async def request_lulu_isbn(self, lulu_adapter, book_spec) -> tuple[str | None, str | None]:

### services/print_service/kdp_adapter.py
  35: class KDPAdapter(PrintProviderAdapter):
  46:     def __init__(self):
  50:     def provider_name(self) -> str:
  53:     async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
  89:     async def submit_order(
  173:     async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
  185:     def _generate_instructions(self, spec: BookSpec) -> str:

### services/print_service/lulu_adapter.py
  29: class LuluAdapter(PrintProviderAdapter):
  36:     def __init__(self, client_id: str, client_secret: str):
  44:     def provider_name(self) -> str:
  47:     async def _authenticate(self) -> str:
  105:     def _get_pod_package_id(self, book_spec: BookSpec) -> str:
  122:     async def get_pricing(self, book_spec: BookSpec, shipping_address: dict) -> PricingEstimate:
  209:     async def submit_order(
  303:     async def get_order_status(self, provider_order_id: str) -> OrderStatusResult:
  379:     async def request_free_isbn(self, book_spec: BookSpec) -> str:

### services/print_service/order_service.py
  32: class OrderService:
  43:     def __init__(self, db: AsyncSession, user_id: UUID):
  50:     async def get_pricing(
  74:     async def submit_order(
  172:     async def _submit_with_retry(
  219:     async def _submit_bookvault_multi(
  273:     async def _resolve_adapter(self, provider: str) -> PrintProviderAdapter:
  306:     async def _load_project(self, project_id: UUID) -> BookProject:
  319:     def _build_book_spec(self, project: BookProject, quantity: int = 1) -> BookSpec:
  332:     def _parse_shipping_address(self, address_text: str) -> dict:

### services/quality_controller/applier.py
  13: class CorrectionApplierService:
  16:     def __init__(self, db: AsyncSession, user_id: UUID):
  20:     async def apply_corrections(self, project_id: UUID) -> dict:

### services/quality_controller/prompts.py
  44: def build_user_prompt(chunk_text: str) -> str:

### services/quality_controller/scanner.py
  19: class TextChunk:
  28: def chunk_by_chapters(
  83: def _split_large_chapter(
  155: def _split_by_words(
  194: def chunk_text(
  203: def parse_ai_response(response: str, chunk_start_position: int) -> list[dict]:
  257: def deduplicate_corrections(corrections: list[dict]) -> list[dict]:

### services/quality_controller/tasks.py
  15: def scan_typos_task(self, project_id: str, user_id: str) -> dict:
  26: async def _scan_typos_async(task, project_id: str, user_id: str) -> dict:

### services/scoped_query.py
  11: class UserScopedQuery:
  23:     def __init__(self, db: AsyncSession, user_id: UUID):
  27:     def base_query(self, model: type) -> Select:
  34:     async def get_by_id(self, model: type, resource_id: UUID):
  48:     async def create(self, instance) -> object:
  55:     async def list_all(self, model: type, **filters):

### services/source_service/__init__.py
  40: def register_builtin_providers() -> None:

### services/source_service/base.py
  20: class SourceProvider(ABC):
  25:     def provider_id(self) -> str:
  31:     def display_name(self) -> str:
  37:     def quality_label(self) -> str:
  42:     def is_high_quality(self) -> bool:
  47:     async def search(self, query: str, limit: int = 50) -> list[SearchResult]:
  57:     async def download(self, source_id: str) -> SourceDocument:
  66:     async def get_metadata(self, source_id: str) -> BookMetadata:

### services/source_service/exceptions.py
  4: class ProviderUnavailableError(Exception):
  7:     def __init__(self, provider: str, message: str):
  13: class DownloadError(Exception):
  16:     def __init__(self, provider: str, message: str):
  22: class ValidationError(Exception):
  25:     def __init__(self, message: str, error_code: str = "VALIDATION_ERROR"):
  31: class StorageError(Exception):
  34:     def __init__(self, message: str, error_code: str = "STORAGE_ERROR"):
  40: class NormalizationError(Exception):
  43:     def __init__(self, message: str, stderr: str = ""):

### services/source_service/models.py
  8: class ValidationErrorCode(str, Enum):
  18: class ValidationResult:
  29: class BookMetadata:
  47: class SearchResult:
  64: class ExtractedImage:
  74: class SourceDocument:
  84: class Chapter:
  93: class NormalizationResult:

### services/source_service/providers/gutenberg.py
  25: class GutenbergProvider(SourceProvider):
  35:     def __init__(self, search_timeout: float = 8.0, download_timeout: float = 30.0) -> None:
  48:     def provider_id(self) -> str:
  52:     def display_name(self) -> str:
  56:     def quality_label(self) -> str:
  59:     async def search(self, query: str, limit: int = 50) -> list[SearchResult]:
  132:     async def download(self, source_id: str) -> SourceDocument:
  177:     async def _fetch_book_data(self, source_id: str) -> dict:
  210:     def _select_format(
  261:     async def _download_with_retry(self, url: str, source_id: str) -> bytes:
  325:     def _extract_metadata(self, book_data: dict, source_id: str) -> BookMetadata:
  355:     def _extract_license_text(self, content: bytes, file_format: str) -> str | None:
  410:     async def get_metadata(self, source_id: str) -> BookMetadata:
  448:     def _parse_metadata(self, data: dict, source_id: str) -> BookMetadata:

### services/source_service/providers/standard_ebooks.py
  33: class StandardEbooksProvider(SourceProvider):
  48:     def __init__(self, timeout: float = 8.0) -> None:
  59:     def provider_id(self) -> str:
  63:     def display_name(self) -> str:
  67:     def quality_label(self) -> str:
  71:     def is_high_quality(self) -> bool:
  75:     async def search(self, query: str, limit: int = 50) -> list[SearchResult]:
  122:     async def download(self, source_id: str) -> SourceDocument:
  221:     async def get_metadata(self, source_id: str) -> BookMetadata:
  257:     async def _get_catalog(self) -> list[dict]:
  306:     def _parse_opds_feed(self, xml_text: str) -> list[dict]:

### services/source_service/providers/upload.py
  51: class UploadProvider:
  58:     async def validate(self, file_path: Path) -> ValidationResult:
  157:     def _check_magic_bytes(self, header: bytes, extension: str) -> bool:
  186:     def _is_text_content(sample: bytes) -> bool:
  205:     def _check_readability(self, file_path: Path, extension: str) -> Optional[str]:
  226:     def _check_epub_readable(file_path: Path) -> Optional[str]:
  246:     def _check_docx_readable(file_path: Path) -> Optional[str]:
  275:     def _check_pdf_readable(file_path: Path) -> Optional[str]:
  303:     def _check_txt_readable(file_path: Path) -> Optional[str]:
  329:     async def extract_metadata(self, file_path: Path, format: str) -> BookMetadata:
  357:     def _extract_epub_metadata(self, file_path: Path) -> BookMetadata:
  389:     def _get_epub_field(self, book, namespace: str, field: str) -> Optional[str]:
  411:     def _extract_docx_metadata(self, file_path: Path) -> BookMetadata:
  459:     def _extract_pdf_metadata(self, file_path: Path) -> BookMetadata:
  513:     def _parse_pdf_date(self, date_str: str) -> Optional[str]:
  549:     async def normalize(self, file_path: Path, format: str) -> NormalizationResult:
  583:     async def _normalize_pdf(self, file_path: Path) -> NormalizationResult:
  651:     async def _run_pandoc(
  737:     def _detect_chapters(self, html_content: str) -> list[Chapter]:
  766:     def _collect_extracted_images(self, media_dir: Path) -> list[ExtractedImage]:
  819:     async def extract_images(self, file_path: Path) -> list[ExtractedImage]:
  864:     def _build_image_placement_map(self, book) -> dict[str, Optional[str]]:
  911:     def _get_spine_documents(self, book) -> list:
  927:     def _get_document_label(self, doc_item, spine_index: int) -> str:
  960:     def _find_image_references(self, html_text: str) -> list[str]:
  988:     def _normalize_image_path(img_ref: str, doc_path: str) -> str:

### services/source_service/registry.py
  19: class ProviderRegistry:
  27:     def __init__(self, disabled_providers: Optional[set[str]] = None) -> None:
  31:     def register(self, provider: SourceProvider) -> None:
  40:     def get_enabled_providers(self) -> list[SourceProvider]:
  46:     def get_provider(self, provider_id: str) -> Optional[SourceProvider]:
  52:     def get_all_providers(self) -> dict[str, SourceProvider]:
  56:     def is_registered(self, provider_id: str) -> bool:
  60:     def is_enabled(self, provider_id: str) -> bool:
  64:     def enable(self, provider_id: str) -> None:
  68:     def disable(self, provider_id: str) -> None:
  73: def _load_disabled_providers_from_config() -> set[str]:
  94: def create_provider_registry() -> ProviderRegistry:

### services/source_service/search_service.py
  11: class ProviderStatus:
  19: class FederatedSearchResponse:
  26: class SearchService:
  29:     async def search(self, query: str, timeout: float = 10.0) -> FederatedSearchResponse:
  96:     async def _search_provider(self, provider, query: str) -> list[SearchResult]:

### services/source_service/storage/base.py
  6: class StorageBackend(ABC):
  17:     async def store(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
  34:     async def retrieve(self, key: str) -> bytes:
  49:     async def delete(self, key: str) -> None:
  62:     async def exists(self, key: str) -> bool:

### services/source_service/storage/factory.py
  21: def create_storage_backend() -> StorageBackend:
  65: def get_storage_backend() -> StorageBackend:
  85: def reset_storage_backend() -> None:

### services/source_service/storage/local.py
  21: class LocalStorage(StorageBackend):
  28:     def __init__(self, base_path: str) -> None:
  32:     def base_path(self) -> Path:
  36:     async def store(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
  55:     async def retrieve(self, key: str) -> bytes:
  75:     async def delete(self, key: str) -> None:
  93:     async def exists(self, key: str) -> bool:

### services/source_service/storage/s3.py
  15: class S3Storage(StorageBackend):
  27:     def __init__(
  57:     def _get_client_kwargs(self) -> dict:
  71:     async def store(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
  124:     async def retrieve(self, key: str) -> bytes:
  176:     async def delete(self, key: str) -> None:
  221:     async def exists(self, key: str) -> bool:

### services/typeset/chapter_detector.py
  8: class Chapter:
  35: class ChapterDetector:
  38:     def detect(self, text: str, epub_nav: list[dict] | None = None) -> list[Chapter]:
  47:     def _detect_from_epub_nav(self, text: str, nav_entries: list[dict]) -> list[Chapter]:
  72:     def _detect_from_patterns(self, text: str) -> list[Chapter]:
  90:     def _split_by_matches(
  116:     def _extract_title(self, match: re.Match) -> str:

### services/typeset/pdf_generator.py
  11: class TypesetCompilationError(Exception):
  14:     def __init__(self, message: str, stderr: str):
  21: def generate_pdf_task(self, project_id: str, user_id: str, provider: str = "lulu") -> dict:
  27: async def _generate_pdf_async(task, project_id: str, user_id: str, provider: str) -> dict:
  134: def compile_typst(source_path: Path, output_path: Path) -> int:
  166: def _read_pdf_page_count(pdf_path: Path) -> int:

### services/typeset/provider_specs.py
  7: class ProviderSpec:
  62: def get_provider_spec(provider: str) -> ProviderSpec:

### services/typeset/qr_generator.py
  11: class QRGenerator:
  14:     def generate_info_page_qr(self, app_url: str, output_dir: Path) -> Path:
  19:     def generate_attribution_qr(self, source_url: str, output_dir: Path) -> Path:
  24:     def _generate_qr(self, url: str, output_path: Path) -> Path:

### services/typeset/template_renderer.py
  11: class BookMetadata:
  24: class TypesetAssets:
  30: class TemplateRenderer:
  33:     def render_full(
  49:     def _render_document_setup(self, spec: ProviderSpec) -> str:
  65:     def _render_front_matter(self, metadata: BookMetadata, assets: TypesetAssets) -> str:
  118:     def _render_body(self, chapters: list[Chapter], metadata: BookMetadata) -> str:
  157:     def _render_back_matter(self, metadata: BookMetadata, assets: TypesetAssets) -> str:
  193:     def _escape_typst(self, text: str) -> str:

### services/user_service.py
  12: class UserService:
  15:     def __init__(self, db: AsyncSession):
  18:     async def get_profile(self, user_id: UUID) -> User:
  28:     async def update_profile(self, user_id: UUID, display_name: str | None = None) -> User:

### utils/encryption.py
  11: def _derive_key(user_salt: str) -> bytes:
  18: def encrypt_value(plaintext: str, user_salt: str) -> str:
  25: def decrypt_value(ciphertext: str, user_salt: str) -> str:

### utils/exceptions.py
  6: class NotFoundError(HTTPException):
  7:     def __init__(self, detail: str = "Resource not found"):
  11: class UnauthorizedError(HTTPException):
  12:     def __init__(self, detail: str = "Authentication required"):
  16: class ForbiddenError(HTTPException):
  17:     def __init__(self, detail: str = "Access denied"):
  21: class ValidationError(HTTPException):
  22:     def __init__(self, detail: str = "Validation failed"):
  26: class ServiceUnavailableError(HTTPException):
  27:     def __init__(self, detail: str = "Service temporarily unavailable"):

## Frontend (Svelte/TypeScript) — UI Controls

### lib/api.ts
  Functions (2): request, request

### routes/+layout.svelte
  State vars (1): user
  Functions (4): checkAuth, logout, checkAuth, logout
  Buttons: 1
    1. onclick=logout disabled=no
  Links: 5
    1. href=/ text="C.W.'s O-POD"
    2. href=/search text="Search"
    3. href=/bookshelf text="Bookshelf"
    4. href=/settings text="Settings"
    5. href=/login text="Login"

### routes/+page.svelte
  State vars (3): projects, loading, authenticated
  Functions (1): statusLabel
  Links: 3
    1. href=/search text="Find a Book"
    2. href=/bookshelf text="My Bookshelf"
    3. href=/login text="Sign In / Register"

### routes/settings/+page.svelte
  State vars (29): textProvider, textModel, textApiKey, textApiKeySet, imageProvider, imageModel, imageApiKey, imageApiKeySet, aiSaving, aiMessage, aiError, email, displayName, profileSaving, profileMessage, profileError, defaultProvider, printSaving, printMessage, printError, luluConfigured, bookvaultConfigured, luluClientId, luluClientSecret, bookvaultApiKey, credSaving, credMessage, credError, loading
  Functions (18): saveAIConfig, clearTextApiKey, clearImageApiKey, saveProfile, saveLuluCredentials, saveBookvaultCredentials, deleteCredentials, logout, savePrintSettings, saveAIConfig, clearTextApiKey, clearImageApiKey, saveProfile, saveLuluCredentials, saveBookvaultCredentials, deleteCredentials, logout, savePrintSettings
  Buttons: 10
    1. onclick=clearTextApiKey disabled=no
    2. onclick=clearImageApiKey disabled=no
    3. onclick=saveAIConfig disabled=aiSaving
    4. onclick=savePrintSettings disabled=printSaving
    5. onclick=? disabled=no
    6. onclick=saveLuluCredentials disabled=credSaving
    7. onclick=? disabled=no
    8. onclick=saveBookvaultCredentials disabled=credSaving
    9. onclick=saveProfile disabled=profileSaving
    10. onclick=logout disabled=no
  Inputs: 9
    1. type=text bind=textModel placeholder="e.g. gpt-4o, claude-sonnet-4-2" maxlength=-
    2. type=password bind=textApiKey placeholder="" maxlength=-
    3. type=text bind=imageModel placeholder="e.g. dall-e-3, stability-ai/sd" maxlength=-
    4. type=password bind=imageApiKey placeholder="" maxlength=-
    5. type=text bind=luluClientId placeholder="Your Lulu API client ID" maxlength=-
    6. type=password bind=luluClientSecret placeholder="Your Lulu API client secret" maxlength=-
    7. type=password bind=bookvaultApiKey placeholder="Your BookVault API key" maxlength=-
    8. type=email bind=? placeholder="" maxlength=-
    9. type=text bind=displayName placeholder="Your name" maxlength=-
  Selects: 3
    1. id=text-provider bind=textProvider
    2. id=image-provider bind=imageProvider
    3. id=default-provider bind=defaultProvider

### routes/projects/[id]/+page.svelte
  State vars (13): currentStep, project, loading, actionLoading, actionError, actionMessage, corrections, typoScanning, typoTaskId, printProvider, shippingAddress, pricingEstimate, pricingLoading
  Functions (18): loadProject, scanTypos, loadCorrections, bulkCorrections, updateCorrection, applyCorrections, startTypeset, getPricing, submitPrintOrder, loadProject, scanTypos, loadCorrections, bulkCorrections, updateCorrection, applyCorrections, startTypeset, getPricing, submitPrintOrder
  Buttons: 14
    1. onclick=? disabled=no
    2. onclick=? disabled=no
    3. onclick=? disabled=no
    4. onclick=? disabled=no
    5. onclick=? disabled=no
    6. onclick=? disabled=no
    7. onclick=applyCorrections disabled=actionLoading
    8. onclick=? disabled=no
    9. onclick=scanTypos disabled=actionLoading
    10. onclick=? disabled=no
    11. onclick=startTypeset disabled=actionLoading
    12. onclick=? disabled=no
    13. onclick=getPricing disabled=pricingLoading
    14. onclick=submitPrintOrder disabled=actionLoading
  Selects: 1
    1. id=print-provider bind=printProvider
  Textareas: 1
    1. bind=shippingAddress rows=3
  Links: 5
    1. href=project.source_url text="View original"
    2. href=/api/projects/{projectId}/interior-pdf text="Download PDF"
    3. href=/projects/{projectId}/cover text="Edit Cover"
    4. href=/projects/{projectId}/cover text="Open Cover Builder"
    5. href=/api/projects/{projectId}/interior-pdf text="Download Interior PDF"

### routes/projects/[id]/cover/+page.svelte
  State vars (23): prompts, images, selectedImage, blurb, blurbEditable, loading, imageLoading, step, error, message, titleText, authorText, assembling, templates, selectedTemplate, titleFontSize, titleColor, titleFontFamily, authorFontSize, authorColor, authorFontFamily, spineWidth, pageCount
  Functions (14): updateSpineWidth, generatePrompts, generateImage, generateBlurb, assembleCover, handleUpload, updateSpineWidth, generatePrompts, generateImage, generateBlurb, applyTemplate, assembleCover, selectImage, handleUpload
  Buttons: 9
    1. onclick=generatePrompts disabled=loading
    2. onclick=? disabled=no
    3. onclick=? disabled=no
    4. onclick=? disabled=no
    5. onclick=? disabled=no
    6. onclick=? disabled=no
    7. onclick=generateBlurb disabled=loading
    8. onclick=assembleCover disabled=assembling
    9. onclick=? disabled=no
  Inputs: 8
    1. type=file bind=? placeholder="" maxlength=-
    2. type=file bind=? placeholder="" maxlength=-
    3. type=text bind=titleText placeholder="Book Title" maxlength=100
    4. type=number bind=titleFontSize placeholder="" maxlength=-
    5. type=color bind=titleColor placeholder="" maxlength=-
    6. type=text bind=authorText placeholder="Author Name" maxlength=60
    7. type=number bind=authorFontSize placeholder="" maxlength=-
    8. type=color bind=authorColor placeholder="" maxlength=-
  Selects: 2
    1. id=? bind=titleFontFamily
    2. id=? bind=authorFontFamily
  Textareas: 1
    1. bind=blurbEditable rows=5
  Links: 1
    1. href=/projects/{projectId} text="← Back to project"

### routes/bookshelf/+page.svelte
  State vars (17): books, totalCount, currentPage, totalPages, loading, error, selectedIds, batchMode, batchOrdering, batchProvider, batchAddress, batchMessage, batchError, statusFilter, dragIndex, estimateData, estimating
  Functions (13): loadBookshelf, submitBatchOrder, getEstimate, handleDrop, loadBookshelf, toggleSelect, submitBatchOrder, getEstimate, handleDragStart, handleDragOver, handleDrop, statusLabel, statusColor
  Buttons: 6
    1. onclick=? disabled=no
    2. onclick=? disabled=currentPage <= 1
    3. onclick=? disabled=no
    4. onclick=getEstimate disabled=estimating || selectedIds.size < 2
    5. onclick=? disabled=no
    6. onclick=submitBatchOrder disabled=batchOrdering || selectedIds.size < 2
  Inputs: 1
    1. type=checkbox bind=? placeholder="" maxlength=-
  Selects: 2
    1. id=? bind=statusFilter
    2. id=batch-provider bind=batchProvider
  Textareas: 1
    1. bind=batchAddress rows=3
  Links: 3
    1. href=/search text="Find a Book"
    2. href=/search text="Find a Book to Get Started"
    3. href=/projects/{book.id} text="{book.title}"

### routes/search/+page.svelte
  State vars (6): query, results, loading, error, importing, importMessage
  Functions (4): search, importBook, search, importBook
  Buttons: 2
    1. onclick=? disabled=loading || query.length < 2
    2. onclick=? disabled=no
  Inputs: 2
    1. type=text bind=query placeholder="Search by title or author..." maxlength=-
    2. type=file bind=? placeholder="" maxlength=-

### routes/login/+page.svelte
  State vars (5): email, password, loading, error, mode
  Functions (2): submit, submit
  Buttons: 3
    1. onclick=? disabled=loading
    2. onclick=? disabled=no
    3. onclick=? disabled=no
  Inputs: 2
    1. type=email bind=email placeholder="you@example.com" maxlength=-
    2. type=password bind=password placeholder="" maxlength=-


## Frontend — Detailed UI Control Descriptions

### routes/+layout.svelte
- **Buttons:** Logout (onclick: logout)
- **Links:** Logo → /, Search → /search, Bookshelf → /bookshelf, Settings → /settings, Login → /login

### routes/+page.svelte (Home/Dashboard)
- **Links:** "Find a Book" → /search, "My Bookshelf" → /bookshelf, "Sign In / Register" → /login, Project links → /projects/{id}

### routes/login/+page.svelte
- **Inputs:** email (type=email, required), password (type=password, required, minlength=8 in register mode)
- **Buttons:** Submit (type=submit, "Sign In" or "Create Account"), Toggle mode ("Create one" / "Sign in")
- **Form:** onsubmit → submit()

### routes/search/+page.svelte
- **Inputs:** Search query (type=text, placeholder="Search by title or author..."), File upload (type=file, accept=".epub,.docx,.txt,.pdf")
- **Buttons:** Search submit (disabled when query < 2 chars), "Start Project" per result (onclick: importBook)
- **Form:** onsubmit → search()

### routes/settings/+page.svelte
- **Selects:** Text provider (local/openai/anthropic), Image provider (local/openai/replicate), Default print provider (lulu/bookvault/kdp)
- **Inputs:** Text model, Text API key (password), Image model, Image API key (password), Email (disabled), Display name, Lulu client ID, Lulu client secret (password), BookVault API key (password)
- **Buttons:** Remove text key, Remove image key, Save AI Settings, Save Print Settings, Remove Lulu creds, Save Lulu creds, Remove BookVault creds, Save BookVault creds, Update Profile, Log Out

### routes/bookshelf/+page.svelte
- **Selects:** Status filter (all/draft/typeset/cover_ready/print_ready/ordered/shipped), Batch provider (lulu/bookvault/kdp)
- **Inputs:** Batch checkbox (per book, type=checkbox)
- **Textareas:** Batch shipping address (rows=3)
- **Buttons:** Batch Order toggle, Previous page, Next page, Get Pricing Estimate, Back (from estimate), Confirm Order
- **Links:** "Find a Book" → /search, Book title → /projects/{id}
- **Drag-and-drop:** Each book card is draggable (ondragstart/ondragover/ondrop)

### routes/projects/[id]/+page.svelte (Guided Workflow)
- **Selects:** Print provider (lulu/bookvault/kdp)
- **Textareas:** Shipping address (rows=3)
- **Buttons:** Step nav (5 steps), Continue to Typo Check, Scan for Typos, Skip, Accept All, Reject All, Accept (per correction), Reject (per correction), Apply Accepted & Continue, Generate Interior PDF, Continue to Cover, Continue to Print, Get Price Estimate, Submit Print Order / Prepare KDP Files
- **Links:** View original source, Download PDF, Open Cover Builder, Edit Cover, Download Interior PDF

### routes/projects/[id]/cover/+page.svelte (Cover Studio)
- **Selects:** Title font family (5 options), Author font family (5 options)
- **Inputs:** File upload (×2, accept=".png,.jpg,.jpeg"), Title text (maxlength=100), Title font size (number, 8-200), Title color (color picker), Author text (maxlength=60), Author font size (number, 8-200), Author color (color picker)
- **Textareas:** Blurb editor (rows=5, maxlength=3000)
- **Buttons:** Generate Cover Prompts, Generate Image (per prompt), Use This/Selected (per image), Back (×2), Continue to Cover Builder, Template buttons (×5), Generate Synopsis, Generate Print-Ready Cover PDF
- **Links:** "← Back to project" → /projects/{id}
