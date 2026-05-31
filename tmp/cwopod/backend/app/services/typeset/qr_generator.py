"""QR code generator for Info_Page and Attribution_Page."""

from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_H

MIN_QR_SIZE_PX = 236  # 2cm at 300 DPI


class QRGenerator:
    """Generates QR code images for book pages."""

    def generate_info_page_qr(self, app_url: str, output_dir: Path) -> Path:
        """Generate QR code for the Info_Page linking to CWOPOD."""
        output_path = output_dir / "info_page_qr.png"
        return self._generate_qr(app_url, output_path)

    def generate_attribution_qr(self, source_url: str, output_dir: Path) -> Path:
        """Generate QR code for the Attribution_Page linking to the source."""
        output_path = output_dir / "attribution_qr.png"
        return self._generate_qr(source_url, output_path)

    def _generate_qr(self, url: str, output_path: Path) -> Path:
        """Generate a QR code image encoding the given URL."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        qr = qrcode.QRCode(
            version=None,  # Auto-size
            error_correction=ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        # Ensure minimum size
        if img.size[0] < MIN_QR_SIZE_PX:
            from PIL import Image
            img = img.resize((MIN_QR_SIZE_PX, MIN_QR_SIZE_PX), Image.NEAREST)

        img.save(str(output_path))
        return output_path
