"""Customer photos.

Photos are NOT kept in the database. They go to Cloudinary (set CLOUDINARY_URL), and the database
only keeps the link. Without Cloudinary (local development) the file is saved in ./media instead.
"""
import io
import logging
import os
import uuid

from django.conf import settings
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

MAX_BYTES = 1024 * 1024  # 1 MB
ALLOWED_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
MIN_SIDE = 150      # px: smaller than this, a face is not recognisable
MAX_SIDE = 6000     # px: protects the server from huge images
FACE_CROP = "c_fill,g_face,w_{size},h_{size},q_auto,f_auto"


class PhotoError(Exception):
    """A problem with the photo that the person can fix."""


def validate_photo(file):
    """Raises PhotoError unless `file` is a real JPEG/PNG/WEBP of at most 1 MB."""
    size = getattr(file, "size", None)
    if size is None:
        raise PhotoError("Please choose a photo.")
    if size == 0:
        raise PhotoError("This file is empty. Please choose another photo.")
    if size > MAX_BYTES:
        raise PhotoError(
            f"This photo is {size / (1024 * 1024):.1f} MB. Please choose a photo smaller than 1 MB."
        )
    try:
        file.seek(0)
        image = Image.open(file)
        image.verify()  # is it really an image?
        file.seek(0)
        image = Image.open(file)
        fmt, (width, height) = image.format, image.size
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise PhotoError("This file is not a valid photo. Please upload a JPG, PNG or WEBP image.")
    finally:
        file.seek(0)
    if fmt not in ALLOWED_FORMATS:
        raise PhotoError("Please upload a JPG, PNG or WEBP photo.")
    if min(width, height) < MIN_SIDE:
        raise PhotoError(f"This photo is too small ({width}x{height}). Use one at least {MIN_SIDE}x{MIN_SIDE} pixels.")
    if max(width, height) > MAX_SIDE:
        raise PhotoError("This photo has too many pixels. Please choose a smaller one.")
    return ALLOWED_FORMATS[fmt]


def cloudinary_ready():
    return bool(settings.CLOUDINARY_URL)


def store_photo(file, folder="konark/customers"):
    """Save a validated photo. Returns (url, public_id)."""
    extension = validate_photo(file)
    data = file.read()
    file.seek(0)
    name = uuid.uuid4().hex

    if cloudinary_ready():
        import cloudinary.uploader

        result = cloudinary.uploader.upload(
            io.BytesIO(data), folder=folder, public_id=name, resource_type="image",
            overwrite=False, invalidate=True,
        )
        return result["secure_url"], result["public_id"]

    # Local fallback (development)
    relative = f"customers/{name}.{extension}"
    path = os.path.join(settings.MEDIA_ROOT, relative)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(data)
    return f"{settings.MEDIA_URL}{relative}", relative


def delete_photo(public_id):
    """Best effort: a failed clean-up must never break the real action."""
    if not public_id:
        return
    try:
        if cloudinary_ready():
            import cloudinary.uploader

            cloudinary.uploader.destroy(public_id, invalidate=True)
        else:
            path = os.path.join(settings.MEDIA_ROOT, public_id)
            if os.path.isfile(path):
                os.remove(path)
    except Exception:
        logger.exception("Could not delete photo %s", public_id)


def display_url(url, size=400):
    """The link the website shows: a square crop centred on the face (Cloudinary does this)."""
    if not url:
        return ""
    marker = "/image/upload/"
    if marker in url:
        head, tail = url.split(marker, 1)
        return f"{head}{marker}{FACE_CROP.format(size=size)}/{tail}"
    return url
