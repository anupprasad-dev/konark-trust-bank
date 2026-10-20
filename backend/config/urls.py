from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Konark Trust Bank - Django Admin"
admin.site.site_title = "Konark Trust Bank"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
