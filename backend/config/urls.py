from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Konark Trust Bank - Django Admin"
admin.site.site_title = "Konark Trust Bank"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)  # local photos
